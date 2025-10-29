// src/ai/aiEngine.js
// v4.1 — guardrails + model fallback + Kelly (drift/momentum/volatility) + EV helper

import kellyDynamic from '../utils/aiPredictionEngineModules/kellyDynamic.js';
import volatilityScore from '../utils/aiPredictionEngineModules/volatilityScore.js';
import { validateInsightsHost } from '../utils/content.js';

// ===== Tunables =====
const DAILY_STAKE_CAP_PCT = 0.10;            // max συνολικό ρίσκο/μέρα (10%)
const PER_MATCH_COOLDOWN_MIN = 45;           // lockout λεπτά στο ίδιο ματς
const MIN_CONF = 0.55;                       // ελάχιστο confidence για να εξεταστεί
const MIN_EV = 0.01;                         // ελάχιστο EV όταν υπάρχει
const DEFAULT_KELLY_FACTOR = 0.5;            // half-Kelly
const DEFAULT_CAP_PCT = 0.02;                // 2% cap ανά bet
const LEDGER_KEY_PREFIX = 'LBQ_LEDGER_';
const MODEL_CACHE_KEY = 'LBQ_MODEL_CUTOFFS_CACHE';
const MODEL_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// ===== Persistence =====
function todayKey() {
  const d = new Date();
  const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  return LEDGER_KEY_PREFIX + k;
}
function loadLedger() {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : { totalStakePct: 0, bets: {} };
  } catch { return { totalStakePct: 0, bets: {} }; }
}
function saveLedger(ledger) { try { localStorage.setItem(todayKey(), JSON.stringify(ledger)); } catch {} }
function minutesSince(ts) { return ts ? (Date.now() - ts) / 60000 : 1e9; }

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

// ===== EV helper (για συμβατότητα με παλιούς imports) =====
export function calculateEV(arg1, arg2) {
  // Δέχεται είτε (p, odds) είτε ({ conf|prob|p, odds })
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
  return b * p - (1 - p); // EV per 1 unit stake
}

// ===== Core API =====
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

  // Confidence gate με fallback στα model cutoffs
  const model = readModelCutoffs();
  const thrConf = Math.max(MIN_CONF, Number(model?.thrRisky || 0));
  if (!Number.isFinite(conf) || conf < thrConf) return deny('low-confidence');

  // EV gate (αν υπάρχει match.ev)
  const ev = Number(match?.ev);
  if (Number.isFinite(ev) && ev < MIN_EV) return deny('low-ev');

  // Daily cap / cooldown
  const ledger = loadLedger();
  if (ledger.totalStakePct >= DAILY_STAKE_CAP_PCT - 1e-6) return deny('daily-cap-reached');

  const matchId = String(match?.id || match?.matchId || '');
  if (!matchId) return deny('no-match-id');

  const lastBetTs = ledger.bets[matchId]?.ts || 0;
  if (minutesSince(lastBetTs) < PER_MATCH_COOLDOWN_MIN) return deny('match-cooldown');

  // Volatility
  const vol = clamp01(Number(match?.volatility) || volatilityScore(match));

  // Kelly sizing
  const { stakePct } = kellyDynamic({
    conf,
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
      conf: round4(conf),
      odds: round4(odds),
      volatility: vol,
      drift: round4(drift),
      momentum: round4(momentum),
      remainingDailyCap: round4(remaining),
      cooldownMin: PER_MATCH_COOLDOWN_MIN,
      ev: Number.isFinite(ev) ? round4(ev) : null,
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

// ===== utils =====
function clamp01(x) { const n = Number(x); return !Number.isFinite(n) ? 0 : n < 0 ? 0 : n > 1 ? 1 : n; }
function round4(x) { return Math.round((Number(x) || 0) * 1e4) / 1e4; }
function deny(reason) { return { ok: false, reason, stakePct: 0, meta: {} }; }

export default { suggestBet, registerBet, canBet, calculateEV };