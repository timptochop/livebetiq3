// src/utils/analyzeMatch.js v0.97.0-full
import calculateEV from './aiPredictionEngineModules/calculateEV';
import estimateConfidence from './aiPredictionEngineModules/estimateConfidence';
import calculateKelly from './aiPredictionEngineModules/calculateKelly';
import detectLineMovement from './aiPredictionEngineModules/detectLineMovement';
import surfaceAdjustment from './aiPredictionEngineModules/surfaceAdjustment';

export default function analyzeMatch(match = {}) {
  const now = new Date().toISOString();
  const id = match.id || match['@id'] || 'unknown';
  const players = Array.isArray(match.players) ? match.players : match.player || [];
  const player1 = players[0] || {}, player2 = players[1] || {}, p1 = player1.name || player1['@name'], p2 = player2.name || player2['@name'];

  const odds = match.odds || match['@odds'] || {}, prob1 = Number(odds.prob1), prob2 = Number(odds.prob2);
  const surface = String(match.surface || match['@surface'] || '').toLowerCase();
  const playerStats = match.playerStats || match.stats1 || {}, opponentStats = match.opponentStats || match.stats2 || {};

  let {
    ev: baseEV,
    pick,
    reason: evReason
  } = calculateEV(prob1, prob2);

  let confidence = estimateConfidence(match, pick);
  const momentumBoost = (() => {
    const prevSet = match.prevSet || '';
    if (typeof prevSet === 'string' && prevSet.toLowerCase().includes(pick?.toLowerCase())) return 5;
    return 0;
  })();

  const { drift, driftDirection } = detectLineMovement(match);
  const { evBoost, confidenceBoost } = surfaceAdjustment(surface, playerStats, opponentStats);

  const ev = Number((baseEV + evBoost).toFixed(4));
  confidence = Math.max(0, Math.min(100, confidence + momentumBoost + confidenceBoost));

  const kelly = calculateKelly(ev, confidence / 100);

  let label = '';
  let reason = '';

  if (ev >= 0.025 && confidence >= 58) {
    label = 'SAFE';
    reason = 'High EV & Confidence';
  } else if (ev > 0.015 && confidence > 52) {
    label = 'RISKY';
    reason = 'Moderate EV & Confidence';
  } else if (ev < 0.005 || confidence < 49) {
    label = 'AVOID';
    reason = 'Low EV or Confidence';
  } else {
    label = ''; // fallback handled in LiveTennis.js
  }

  console.table([{
    now,
    id,
    match: `${p1} vs ${p2}`,
    label,
    pick,
    ev,
    confidence,
    kelly: kelly.toFixed(3),
    momentumBoost,
    drift,
    driftDirection,
    evBoost,
    confidenceBoost
  }]);

  return {
    label,
    pick,
    ev,
    confidence,
    kelly,
    reason
  };
}