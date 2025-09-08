// src/utils/analyzeMatch.js
import calculateEV from './utils/aiPredictionEngineModules/calculateEV';
import estimateConfidence from './utils/aiPredictionEngineModules/estimateConfidence';
import calculateKelly from './utils/aiPredictionEngineModules/calculateKelly';
import detectLineMovement from './utils/aiPredictionEngineModules/detectLineMovement';
import applySurfaceAdjustment from './utils/aiPredictionEngineModules/surfaceAdjustment';
import calculateTimeWeightedForm from './utils/aiPredictionEngineModules/timeWeightedForm';
import generateLabel from './utils/aiPredictionEngineModules/generateLabel';
import generateNote from './utils/aiPredictionEngineModules/generateNote';

export default async function analyzeMatch(match) {
  const {
    player1,
    player2,
    odds1,
    odds2,
    prob1,
    prob2,
    preOdds1,
    preOdds2,
    surface,
    status,
    score,
    id,
  } = match;

  const ev = calculateEV(prob1, prob2);
  const confidence = estimateConfidence(prob1, prob2);

  const momentum = score && score.includes('-') ? 1 : 0;

  const surfaceBoost = applySurfaceAdjustment(player1, player2, surface || '');
  const formBoost = await calculateTimeWeightedForm(player1, player2);

  const { driftDetected, lineMovementComment, confidenceBoost } = detectLineMovement(
    preOdds1,
    preOdds2,
    odds1,
    odds2
  );

  const finalConfidence = confidence + momentum + surfaceBoost + formBoost + confidenceBoost;
  const kelly = calculateKelly(ev, finalConfidence / 100);

  const label = generateLabel(ev, finalConfidence, status);
  const note = generateNote(label, player1, player2, ev, finalConfidence);

  console.table([
    {
      matchId: id,
      player1,
      player2,
      ev,
      confidence,
      momentum,
      surfaceBoost,
      formBoost,
      lineDrift: driftDetected,
      finalConfidence,
      label,
      kelly,
    },
  ]);

  return {
    ...match,
    ev,
    confidence: finalConfidence,
    kelly,
    label,
    note,
  };
}