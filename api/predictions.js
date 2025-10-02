// src/utils/predictor.js
//
// Stable predictor v2.1 — χωρίς side effects, σωστό live detection.
//
// Exports:
//  - predictFromFeatures(f)
//  - default export predict(input)  // δέχεται features ή raw match

const VER = 'v2.1-stable';

function num(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function nabs(x, max) {
  if (x == null) return 0;
  return clamp01(Math.abs(Number(x)) / max);
}

function detectSetNumFromPlayers(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {};
  const b = p[1] || {};
  const pick = (o, k) => (o && o[k] != null ? o[k] : null);
  const sA = [pick(a, 's1'), pick(a, 's2'), pick(a, 's3'), pick(a, 's4'), pick(a, 's5')].map((v) =>
    v == null ? null : parseInt(String(v).split(/[.:]/)[0], 10)
  );
  const sB = [pick(b, 's1'), pick(b, 's2'), pick(b, 's3'), pick(b, 's4'), pick(b, 's5')].map((v) =>
    v == null ? null : parseInt(String(v).split(/[.:]/)[0], 10)
  );
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] != null || sB[i] != null) k = i + 1;
  return k || 0;
}

function isUpcomingStatus(s) {
  return String(s || '').toLowerCase() === 'not started';
}
function isFinishedLike(s) {
  const FIN = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
  return FIN.has(String(s || '').toLowerCase());
}

function scoreFeatures(f) {
  const lead     = num(f.lead, 0);
  const lastDiff = num(f.lastDiff, 0);
  const momentum = num(f.momentum, 0);
  const drift    = num(f.drift, 0);
  const pOdds    = num(f.pOdds, null);
  const setNum   = num(f.setNum, 0);

  const nLead  = nabs(lead, 5);
  const nLast  = nabs(lastDiff, 3);
  const nMom   = nabs(momentum, 6);
  const nDrift = nabs(drift, 8);
  const nFav   = pOdds == null ? 0 : clamp01(pOdds - 0.5) * 2;

  let score = 10 * (0.35*nLead + 0.25*nLast + 0.20*nMom + 0.15*nDrift + 0.05*nFav);
  if (setNum >= 3) score += 1.2;

  return clamp01(score / 10) * 10;
}

export function predictFromFeatures(f = {}) {
  // FIX: αν υπάρχει ρητό f.live, το εμπιστευόμαστε. Αλλιώς το συμπεραίνουμε.
  const live =
    typeof f.live === 'boolean'
      ? f.live
      : (!isUpcomingStatus(f.status) && !isFinishedLike(f.status));

  const setNum = num(f.setNum, 0);

  if (!live) {
    return { label: 'SOON', conf: 0.5, kellyLevel: 'LOW', tip: '', version: VER };
  }

  const score = scoreFeatures(f);

  if (setNum >= 2 && score >= 6.0) {
    const conf = 0.88;
    return {
      label: 'SAFE',
      conf,
      kellyLevel: conf >= 0.85 ? 'HIGH' : conf >= 0.72 ? 'MED' : 'LOW',
      tip: f.leaderName || f.leader || f.name1 || '',
      version: VER,
    };
  }

  if (score >= 3.0) {
    const conf = 0.74;
    return {
      label: 'RISKY',
      conf,
      kellyLevel: conf >= 0.85 ? 'HIGH' : conf >= 0.72 ? 'MED' : 'LOW',
      tip: f.leaderName || f.leader || f.name1 || '',
      version: VER,
    };
  }

  const conf = 0.62;
  return { label: 'AVOID', conf, kellyLevel: 'LOW', tip: '', version: VER };
}

export default function predict(input = {}) {
  if (input && (input.setNum != null || input.momentum != null || input.lead != null || input.pOdds != null)) {
    return predictFromFeatures(input);
  }

  const players = input.players || input.player || [];
  const setNum = detectSetNumFromPlayers(players);
  const status = input.status || input['@status'] || '';
  const live = !!status && !isUpcomingStatus(status) && !isFinishedLike(status);

  const features = {
    setNum, live, status,
    name1: players && players[0] ? players[0].name || players[0]['@name'] : '',
    leaderName: input.leader || '',
    momentum: input.momentum,
    drift: input.drift,
    lead: input.lead,
    lastDiff: input.lastDiff,
    pOdds: input.pOdds,
  };

  return predictFromFeatures(features);
}