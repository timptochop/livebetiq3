// src/utils/analyzeMatch.js
import calculateEV from '../utils/aiPredictionEngineModules/calculateEV';
import estimateConfidence from '../utils/aiPredictionEngineModules/estimateConfidence';
import calculateKelly from '../utils/aiPredictionEngineModules/calculateKelly';
import detectLineMovement from '../utils/aiPredictionEngineModules/detectLineMovement';
import applySurfaceAdjustment from '../utils/aiPredictionEngineModules/surfaceAdjustment';
import calculateTimeWeightedForm from '../utils/aiPredictionEngineModules/timeWeightedForm';
import generateLabel from '../utils/aiPredictionEngineModules/generateLabel';
import generateNote from '../utils/aiPredictionEngineModules/generateNote';

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

  // Momentum boost
  if (score?.sets?.length >= 2) {
    const lastSet = score.sets[score.sets.length - 1];
    if (lastSet?.winner === 'player1') confidence += 3;
    else if (lastSet?.winner === 'player2') confidence -= 3;
  }

  const surfaceAdjustedEV = applySurfaceAdjustment({ ev, surface, player1, player2 });
  const formScore = calculateTimeWeightedForm({ lastMatches, player1, player2 });
  const lineMovement = detectLineMovement({ pregameOdds, liveOdds: odds });
  const kelly = calculateKelly({ ev: surfaceAdjustedEV, confidence });
  const label = generateLabel({ ev: surfaceAdjustedEV, confidence });
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