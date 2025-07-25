// src/utils/aiPredictionEngine.js

function calculateEV(odds) {
  return (odds * 0.55 - 1).toFixed(3); // dummy EV formula
}

function calculateConfidence(odds1, odds2) {
  const diff = Math.abs(odds1 - odds2);
  return Math.min(90, Math.max(50, 65 + (odds2 - odds1) * 10));
}

function calculateMomentum() {
  return Math.floor(Math.random() * 5) + 3; // μεταξύ 3 και 7
}

function generateLabel(ev, confidence, momentum) {
  if (ev > 0.045 && confidence >= 65 && momentum >= 5) return 'SAFE';
  if (ev > 0.025 && confidence >= 55) return 'RISKY';
  if (ev === 'STARTS SOON') return 'STARTS SOON';
  return 'AVOID';
}

export function generateTennisPrediction(match) {
  if (!match.oddsPlayer1 || !match.oddsPlayer2) {
    return {
      aiLabel: 'STARTS SOON',
      ev: null,
      confidence: null,
      momentum: null
    };
  }

  const ev1 = parseFloat(calculateEV(match.oddsPlayer1));
  const ev2 = parseFloat(calculateEV(match.oddsPlayer2));

  const confidence = Math.round(
    calculateConfidence(match.oddsPlayer1, match.oddsPlayer2)
  );

  const momentum = calculateMomentum();

  const ev = Math.max(ev1, ev2);
  const aiLabel = generateLabel(ev, confidence, momentum);

  return {
    aiLabel,
    ev,
    confidence,
    momentum
  };
}