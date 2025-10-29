// src/ai/aiEngine.js
import kellyDynamic from '../utils/aiPredictionEngineModules/kellyDynamic.js';
import volatilityScore from '../utils/aiPredictionEngineModules/volatilityScore.js';
import { validateInsightsHost } from '../utils/content.js';

const DAILY_STAKE_CAP_PCT = 0.10;
const PER_MATCH_COOLDOWN_MIN = 45;
const MIN_CONF = 0.55;
const MIN_EV_FALLBACK = 0.01;
const DEFAULT_KELLY_FACTOR = 0.5;
const DEFAULT_CAP_PCT = 0.02;
const LEDGER_KEY_PREFIX = 'LBQ_LEDGER_';
const MODEL_CACHE_KEY = 'LBQ_MODEL_CUTOFFS_CACHE';
const MODEL_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function todayKey() {
  const d = new Date();
  return `${LEDGER_KEY_PREFIX}${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function loadLedger() {
  try { const raw = localStorage.getItem(todayKey()); return raw ? JSON.parse(raw) : { totalStakePct: 0, bets: {} }; }
  catch { return { totalStakePct: 0, bets: {} }; }
}
function saveLedger(ledger){ try{ localStorage.setItem(todayKey(), JSON.stringify(ledger)); }catch{} }
function minutesSince(ts){ return ts ? (Date.now() - ts) / 60000 : 1e9; }

function readModelCutoffs() {
  try {
    const raw = localStorage.getItem(MODEL_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || typeof j.ts !== 'number') return null;
    if (Date.now() - j.ts > MODEL_MAX_AGE_MS) return null;
    return j.cutoffs || null;
  } catch { return null; }
}
function activeCutoffs() {
  const m = readModelCutoffs();
  const thrSafe = Number(m?.thrSafe);
  const thrRisky = Number(m?.thrRisky);
  const minEV = Number(m?.minEV);
  return {
    thrSafe: Number.isFinite(thrSafe) ? thrSafe : 0.60,
    thrRisky: Number.isFinite(thrRisky) ? thrRisky : 0.50,
    minEV: Number.isFinite(minEV) ? minEV : 0.03
  };
}

export function calculateEV(arg1, arg2) {
  let p, odds;
  if (typeof arg1 === 'object' && arg1 !== null) {
    const src = arg1;
    p = Number(src.p ?? src.prob ?? src.conf);
    odds = Number(src.odds ?? arg2);
  } else {
    p = Number(arg1);
    odds = Number(arg2);
  }
  p = clamp01(p);
  if (!Number.isFinite(odds) || odds <= 1) return 0;
  const b = odds - 1;
  return b * p - (1 - p);
}

export function estimateConfidence(x, oddsMaybe) {
  if (typeof x === 'number') return clamp01(x);
  if (typeof x === 'object' && x !== null) {
    const direct = x.conf ?? x.prob ?? x.p;
    if (Number.isFinite(direct)) return clamp01(Number(direct));
    const ev = Number(x.ev);
    const odds = Number(x.odds ?? oddsMaybe);
    if (Number.isFinite(ev) && Number.isFinite(odds) && odds > 1) {
      const p = (ev + 1) / odds;
      return clamp01(p);
    }
  }
  return 0;
}

export function generateLabel(input = {}) {
  const c = activeCutoffs();
  const conf = clamp01(Number(input.conf ?? input.prob ?? input.p ?? 0));
  let ev = Number(input.ev);
  if (!Number.isFinite(ev)) {
    const odds = Number(input.odds);
    if (Number.isFinite(odds) && odds > 1) ev = calculateEV(conf, odds);
  }
  const minEV = Number.isFinite(c.minEV) ? c.minEV : MIN_EV_FALLBACK;
  if (!Number.isFinite(ev) || ev < minEV) return 'AVOID';
  if (conf >= c.thrSafe) return 'SAFE';
  if (conf >= c.thrRisky) return 'RISKY';
  return 'AVOID';
}

export function generateNote(input = {}) {
  const conf = clamp01(Number(input.conf ?? input.prob ?? input.p ?? 0));
  const odds = Number(input.odds);
  let ev = Number(input.ev);
  if (!Number.isFinite(ev) && Number.isFinite(odds) && odds > 1) ev = calculateEV(conf, odds);
  const vol = clamp01(Number(input.volatility ?? input.vol ?? 0.5));
  const drift = clamp(Number(input.drift ?? 0), -1, 1);
  const momentum = clamp(Number(input.momentum ?? 0), -1, 1);
  const label = String(input.label ?? generateLabel({ conf, odds, ev })).toUpperCase();
  const bits = [];
  if (label === 'SAFE') bits.push('SAFE window');
  else if (label === 'RISKY') bits.push('RISKY window');
  else bits.push('AVOID');
  if (Number.isFinite(ev)) {
    if (ev >= 0.05) bits.push('strong EV');
    else if (ev >= 0.02) bits.push('pos EV');
    else bits.push('weak EV');
  }
  if (vol >= 0.7) bits.push('high vol');
  else if (vol <= 0.4) bits.push('stable');
  if (drift <= -0.2) bits.push('market vs pick');
  else if (drift >= 0.2) bits.push('market tailwind');
  if (momentum >= 0.3) bits.push('momentum +');
  else if (momentum <= -0.3) bits.push('momentum -');
  const pct = (conf * 100).toFixed(0);
  return `${label} • ${pct}% • ${bits.join(' | ')}`;
}

export function suggestBet({
  match,
  odds,
  conf,
  drift = 0,
  momentum = 0,
  kellyFactor = DEFAULT_KELLY_FACTOR,
  capPct = DEFAULT_CAP_PCT,
}) {
  validateInsightsHost();
  const model = activeCutoffs();
  const thrConf = Math.max(MIN_CONF, Number(model.thrRisky || 0));
  const confidence = clamp01(conf ?? estimateConfidence(match ?? {}));
  if (!Number.isFinite(confidence) || confidence < thrConf) return deny('low-confidence');
  const ev = Number(match?.ev);
  const minEV = Number.isFinite(model.minEV) ? model.minEV : MIN_EV_FALLBACK;
  if (Number.isFinite(ev) && ev < minEV) return deny('low-ev');
  const ledger = loadLedger();
  if (ledger.totalStakePct >= DAILY_STAKE_CAP_PCT - 1e-6) return deny('daily-cap-reached');
  const matchId = String(match?.id || match?.matchId || '');
  if (!matchId) return deny('no-match-id');
  const lastBetTs = ledger.bets[matchId]?.ts || 0;
  if (minutesSince(lastBetTs) < PER_MATCH_COOLDOWN_MIN) return deny('match-cooldown');
  const vol = clamp01(Number(match?.volatility) || volatilityScore(match));
  const { stakePct } = kellyDynamic({
    conf: confidence,
    odds,
    volatility: vol,
    capPct,
    kellyFactor,
    drift,
    momentum,
  });
  if (stakePct <= 0) return deny('kelly-zero');
  const remaining = Math.max(0, DAILY_STAKE_CAP_PCT - ledger.totalStakePct);
  const finalStake = round4(Math.min(stakePct, remaining));
  if (finalStake <= 0) return deny('daily-cap-tight');
  return {
    ok: true,
    reason: 'ok',
    stakePct: finalStake,
    meta: {
      conf: round4(confidence),
      odds: round4(odds),
      volatility: vol,
      drift: round4(drift),
      momentum: round4(momentum),
      remainingDailyCap: round4(remaining),
      cooldownMin: PER_MATCH_COOLDOWN_MIN,
      ev: Number.isFinite(ev) ? round4(ev) : null,
      cutoffs: model,
      note: generateNote({ conf: confidence, odds, ev, volatility: vol, drift, momentum, label: generateLabel({ conf: confidence, odds, ev }) })
    },
  };
}

export function registerBet(match, stakePct) {
  const matchId = String(match?.id || match?.matchId || '');
  if (!matchId || !Number.isFinite(stakePct) || stakePct <= 0) return false;
  const ledger = loadLedger();
  ledger.totalStakePct = round4(ledger.totalStakePct + stakePct);
  ledger.bets[matchId] = { ts: Date.now(), stakePct };
  saveLedger(ledger);
  return true;
}

export function canBet(match) {
  const matchId = String(match?.id || match?.matchId || '');
  if (!matchId) return { ok: false, reason: 'no-match-id' };
  const ledger = loadLedger();
  if (ledger.totalStakePct >= DAILY_STAKE_CAP_PCT - 1e-6) return { ok: false, reason: 'daily-cap-reached' };
  const lastBetTs = ledger.bets[matchId]?.ts || 0;
  if (minutesSince(lastBetTs) < PER_MATCH_COOLDOWN_MIN) return { ok: false, reason: 'match-cooldown' };
  return { ok: true, reason: 'ok' };
}

function clamp01(x){ const n = Number(x); return !Number.isFinite(n) ? 0 : n < 0 ? 0 : n > 1 ? 1 : n; }
function round4(x){ return Math.round((Number(x) || 0) * 1e4) / 1e4; }
function clamp(x,min,max){ const n=Number(x); if(!Number.isFinite(n)) return min; return n<min?min:n>max?max:n; }
function deny(reason){ return { ok: false, reason, stakePct: 0, meta: {} }; }

export default { suggestBet, registerBet, canBet, calculateEV, estimateConfidence, generateLabel, generateNote };