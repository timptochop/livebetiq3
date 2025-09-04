// analyzeMatch.js v1.2.0
import { calculateEV, estimateConfidence, generateLabel, generateNote, calculateKelly } from './aiPredictionEngine';

export default function analyzeMatch(match) {
  if (!match || typeof match !== 'object') return {};

  const players = Array.isArray(match.players)
    ? match.players
    : Array.isArray(match.player)
    ? match.player
    : [];

  const p1 = players[0] || {};
  const p2 = players[1] || {};

  const odds1 = parseFloat(p1.odds || p1['@odds'] || '');
  const odds2 = parseFloat(p2.odds || p2['@odds'] || '');

  const prob1 = parseFloat(p1.prob || p1['@prob'] || '');
  const prob2 = parseFloat(p2.prob || p2['@prob'] || '');

  if (!odds1 || !odds2 || !prob1 || !prob2) return {};

  const fair = prob1 + prob2;
  const implied1 = prob1 / fair;
  const implied2 = prob2 / fair;

  const ev1 = calculateEV(implied1, odds1);
  const ev2 = calculateEV(implied2, odds2);

  const betterIndex = ev1 > ev2 ? 0 : 1;
  const better = betterIndex === 0 ? p1 : p2;
  const worse = betterIndex === 0 ? p2 : p1;

  const pick = better.name || better['@name'] || '';
  const ev = Math.max(ev1, ev2);
  const confidence = estimateConfidence(ev, better, worse);
  const kelly = calculateKelly(ev, confidence);

  const label = generateLabel(ev, confidence); // returns 'SAFE', 'RISKY', 'AVOID' or null
  const reason = generateNote(label, ev, confidence, pick);

  return {
    ev: ev.toFixed(3),
    confidence: Math.round(confidence),
    kelly: kelly.toFixed(3),
    pick,
    label,
    reason,
  };
}