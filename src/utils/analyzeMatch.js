// src/utils/analyzeMatch.js
import calculateEV from './aiPredictionEngineModules/calculateEV';
import estimateConfidence from './aiPredictionEngineModules/estimateConfidence';
import calculateKelly from './aiPredictionEngineModules/calculateKelly';
import detectLineMovement from './aiPredictionEngineModules/detectLineMovement';
import applySurfaceAdjustment from './aiPredictionEngineModules/surfaceAdjustment';
import calculateTimeWeightedForm from './aiPredictionEngineModules/timeWeightedForm';
import generateLabel from './aiPredictionEngineModules/generateLabel';
import generateNote from './aiPredictionEngineModules/generateNote';

export default function analyzeMatch(match) {
  const {
    id,
    player1,
    player2,
    status,
    odds,
    surface,
    h2h,
    score,
    lastMatches,
    pregameOdds,
  } = match;

  if (!odds || !odds.prob1 || !odds.prob2) {
    return { ...match, ai: { label: 'NO ODDS', ev: null, confidence: null } };
  }

  const ev = calculateEV(odds);
  let confidence = estimateConfidence({ odds, score });

  // Momentum boost (π.χ. προηγούμενο σετ νίκη)
  if (score?.sets?.length >= 2) {
    const lastSet = score.sets[score.sets.length - 1];
    if (lastSet && lastSet.winner === 'player1') confidence += 3;
    else if (lastSet && lastSet.winner === 'player2') confidence -= 3;
  }

  // Surface adjustment
  const surfaceAdjustedEV = applySurfaceAdjustment({ ev, surface, player1, player2 });

  // Time-weighted form
  const formScore = calculateTimeWeightedForm({ lastMatches, player1, player2 });

  // Line movement detection
  const lineMovement = detectLineMovement({ pregameOdds, liveOdds: odds });

  // Kelly Criterion
  const kelly = calculateKelly({ ev: surfaceAdjustedEV, confidence });

  // Label generation
  const label = generateLabel({ ev: surfaceAdjustedEV, confidence });

  // Note generation
  const note = generateNote({ label, ev: surfaceAdjustedEV, confidence, player1, player2 });

  const ai = {
    label,
    ev: surfaceAdjustedEV,
    confidence,
    kelly,
    formScore,
    momentum: score?.sets?.length >= 2 ? 'active' : 'none',
    lineMovement: lineMovement.drift,
    note,
  };

  console.table({
    id,
    player1,
    player2,
    status,
    ev: surfaceAdjustedEV,
    confidence,
    formScore,
    kelly,
    label,
    note,
  });

  return {
    ...match,
    ai,
  };
}