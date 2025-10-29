// src/ai/aiEngine.js
// v4.0 — Kelly + risk guardrails (daily cap, per-match cooldown) + safe model fallback

import kellyDynamic from '../utils/aiPredictionEngineModules/kellyDynamic.js';
import volatilityScore from '../utils/aiPredictionEngineModules/volatilityScore.js';
import { validateInsightsHost } from '../utils/content.js';

// ==== Tunables (safe defaults) ====
const DAILY_STAKE_CAP_PCT = 0.10;          // max συνολικό ρίσκο/ημέρα (10% bankroll)
const PER_MATCH_COOLDOWN_MIN = 45;         // lockout μετά από ένα bet στο ίδιο match
const MIN_CONF = 0.55;                     // min confidence για να εξεταστεί bet
const MIN_EV = 0.01;                       // min expected value για να εξεταστεί bet
const DEFAULT_KELLY_FACTOR = 0.5;          // μισό Kelly
const DEFAULT_CAP_PCT = 0.02;              // 2% hard cap ανά bet
const LEDGER_KEY_PREFIX = 'LBQ_LEDGER_';   // localStorage per-day
const MODEL_CACHE_KEY = 'LBQ_MODEL_CUTOFFS_CACHE';
const MODEL_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h fallback window

// ==== Persistence helpers ====
function todayKey() {
  const d = new Date();
  const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  return LEDGER_KEY_PREFIX + k;
}

function loadLedger() {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : { totalStakePct: 0, bets: {} };
  } catch {
    return { totalStakePct: 0, bets: {} };
  }
}

function saveLedger(ledger) {
  try { localStorage.setItem(todayKey(), JSON.stringify(ledger)); } catch {}
}

function minutesSince(ts) {
  if (!ts) return 1e9;
  return (Date.now() - ts) / 60000;
}

function readModelCutoffs() {
  try {
    const raw = localStorage.getItem(MODEL_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || typeof j.ts !== 'number') return null;
    if (Date.now() - j.ts > MODEL_MAX_AGE_MS) return null;
    return j.cutoffs || null;
  } catch {
    return null;
  }
}

// ==== Core API ====
export function suggestBet({
  match,              // normalized match object
  odds,               // decimal odds for our pick
  conf,               // confidence 0..1
  drift = 0,          // -1..+1 (market drift vs our pick)
  momentum = 0,       // -1..+1 (tail/head wind)
  kellyFactor = DEFAULT_KELLY_FACTOR,
  capPct = DEFAULT_CAP_PCT,
}) {
  // Insights flag (once)
  validateInsightsHost();

  // Guard: minimum filters (conf/EV) with safe model fallback
  const model = readModelCutoffs();
  const thrConf = Math.max(MIN_CONF, Number(model?.thrRisky || 0)); // use model if fresher
  if (!Number.isFinite(conf) || conf < thrConf) {
    return deny('low-confidence');
  }

  // Optional EV gate if match carries ev field
  const ev = Number(match?.ev);
  if (Number.isFinite(ev) && ev < MIN_EV) {
    return deny('low-ev');
  }

  // Risk guardrails (daily cap + per-match cooldown)
  const ledger = loadLedger();
  if (ledger.totalStakePct >= DAILY_STAKE_CAP_PCT - 1e-6) {
    return deny('daily-cap-reached');
  }

  const matchId = String(match?.id || match?.matchId || '');
  if (!matchId) return deny('no-match-id');

  const lastBet = ledger.bets[matchId]?.ts || 0;
  if (minutesSince(lastBet) < PER_MATCH_COOLDOWN_MIN) {
    return deny('match-cooldown');
  }

  // Volatility
  const vol = clamp01(Number(match?.volatility) || volatilityScore(match));

  // Kelly sizing (with drift/momentum damp/boost)
  const { stakePct } = kellyDynamic({
    conf, odds, volatility: vol, capPct, kellyFactor, drift, momentum,
  });

  if (stakePct <= 0) return deny('kelly-zero');

  // Respect remaining daily cap
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
  if (ledger.totalStakePct >= DAILY_STAKE_CAP_PCT - 1e-6) {
    return { ok: false, reason: 'daily-cap-reached' };
  }
  const lastBet = ledger.bets[matchId]?.ts || 0;
  if (minutesSince(lastBet) < PER_MATCH_COOLDOWN_MIN) {
    return { ok: false, reason: 'match-cooldown' };
  }
  return { ok: true, reason: 'ok' };
}

// ==== utils ====
function clamp01(x) { const n = Number(x); return n < 0 ? 0 : n > 1 ? 1 : (Number.isFinite(n) ? n : 0); }
function round4(x) { return Math.round((Number(x) || 0) * 1e4) / 1e4; }
function deny(reason) { return { ok: false, reason, stakePct: 0, meta: {} }; }

export default {
  suggestBet,
  registerBet,
  canBet,
};