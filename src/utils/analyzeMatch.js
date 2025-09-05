import calculateEV from './aiPredictionEngineModules/calculateEV';
import estimateConfidence from './aiPredictionEngineModules/estimateConfidence';
import calculateKelly from './aiPredictionEngineModules/calculateKelly';
import detectLineMovement from './aiPredictionEngineModules/detectLineMovement';
import surfaceAdjustment from './aiPredictionEngineModules/surfaceAdjustment';
import timeWeightedForm from './aiPredictionEngineModules/timeWeightedForm';
import generateLabel from './aiPredictionEngineModules/generateLabel';
import generateNote from './aiPredictionEngineModules/generateNote';

export default function analyzeMatch(match) {
  const player1 = match?.player1?.name || '';
  const player2 = match?.player2?.name || '';
  const odds1 = match?.odds?.player1;
  const odds2 = match?.odds?.player2;
  const preOdds1 = match?.odds?.pregame?.player1;
  const preOdds2 = match?.odds?.pregame?.player2;
  const surface = match?.surface || '';
  const status = (match?.status || '').toLowerCase();
  const score = match?.score || '';

  const fair1 = odds1 ? 1 / odds1 : null;
  const fair2 = odds2 ? 1 / odds2 : null;

  // DEBUG BEFORE SKIP
  console.log('TESTING ODDS >>>', {
    matchId: match?.id || '[no id]',
    player1,
    player2,
    odds1,
    odds2,
    fair1,
    fair2
  });

  // Skip invalid data
  if (!odds1 || !odds2 || !Number.isFinite(fair1) || !Number.isFinite(fair2)) {
    console.log(`Skipping match due to invalid odds:`, match?.id || '[no id]');
    return {
      ev: 0,
      confidence: 0,
      kelly: 0,
      label: 'AVOID',
      note: 'Invalid odds'
    };
  }

  // Base EV
  const ev = calculateEV(fair1, fair2);

  // Form score
  const form1 = timeWeightedForm(player1);
  const form2 = timeWeightedForm(player2);

  // Momentum logic
  const momentumBoost = score.includes('RET') ? 0 : (
    score.includes('1-0') ? 0.05 :
    score.includes('2-0') ? 0.1 : 0
  );

  // Surface adjustment
  const surfaceFactor = surfaceAdjustment(surface, player1, player2);

  // Confidence
  let confidence = estimateConfidence(ev, form1, form2);
  confidence += momentumBoost + surfaceFactor;

  // Line movement adjustment
  const lineMovementComment = detectLineMovement(preOdds1, preOdds2, odds1, odds2);

  // Final Label
  const label = generateLabel({ ev, confidence });
  const kelly = calculateKelly(ev, confidence);
  const note = generateNote({ label, player1, player2 });

  // DEBUG LOGGING
  console.table({
    MatchID: match.id || '[no id]',
    Player1: player1,
    Player2: player2,
    Odds1: odds1,
    Odds2: odds2,
    Fair1: fair1?.toFixed(3),
    Fair2: fair2?.toFixed(3),
    EV: ev?.toFixed(3),
    Confidence: confidence?.toFixed(1),
    Label: label,
    Kelly: kelly?.toFixed(2),
    Surface: surface,
    Form1: form1,
    Form2: form2,
    Momentum: momentumBoost?.toFixed(2),
    SurfaceAdj: surfaceFactor?.toFixed(2),
    LineMove: lineMovementComment
  });

  return {
    ev,
    confidence,
    kelly,
    label,
    note
  };
}