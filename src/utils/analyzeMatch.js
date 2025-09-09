// src/utils/analyzeMatch.js
import calculateEV from "./aiPredictionEngineModules/calculateEV";
import estimateConfidence from "./aiPredictionEngineModules/estimateConfidence";
import calculateKelly from "./aiPredictionEngineModules/calculateKelly";
import detectLineMovement from "./aiPredictionEngineModules/detectLineMovement";
import surfaceAdjustment from "./aiPredictionEngineModules/surfaceAdjustment";
import timeWeightedForm from "./aiPredictionEngineModules/timeWeightedForm";
import generateLabel from "./aiPredictionEngineModules/generateLabel";
import generateNote from "./aiPredictionEngineModules/generateNote";

async function analyzeMatch(match) {
  try {
    const {
      player1,
      player2,
      odds1,
      odds2,
      surface,
      status,
      set,
      scheduledTime,
      matchId,
    } = match;

    // Base EV calculation
    const ev = calculateEV(odds1, odds2);

    // Surface awareness
    const adjustedEV = surfaceAdjustment(ev, surface, player1, player2);

    // Line movement awareness
    const lineMovement = detectLineMovement(match);

    // Time-weighted form
    const formBoost = timeWeightedForm(player1, player2);

    // Momentum (set-based)
    const momentumBoost = set === 2 && match.lastSetWinner ? 0.05 : 0;

    // Final confidence
    const confidence = estimateConfidence(adjustedEV, lineMovement, formBoost, momentumBoost);

    // Kelly Criterion
    const kelly = calculateKelly(adjustedEV, confidence);

    // Label & Note
    const label = generateLabel(adjustedEV, confidence);
    const note = generateNote(label, player1, player2);

    // Logging (for debug mode)
    console.table({
      matchId,
      player1,
      player2,
      ev: adjustedEV.toFixed(3),
      confidence: confidence.toFixed(1),
      kelly: kelly.toFixed(2),
      label,
      note,
    });

    return { ev: adjustedEV, confidence, kelly, label, note };
  } catch (error) {
    console.error("analyzeMatch error:", error);
    return { ev: 0, confidence: 0, kelly: 0, label: "ERROR", note: "AI FAIL" };
  }
}

export default analyzeMatch;