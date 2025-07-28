// server/aiEngine.js

function calculateEV(prob, odds) {
  return (odds * prob) - 1;
}

function getImpliedProbability(odds) {
  return 1 / odds;
}

function getConfidence(ev) {
  if (ev >= 0.10) return 90;
  if (ev >= 0.06) return 75;
  if (ev >= 0.03) return 60;
  if (ev >= 0.01) return 50;
  return 40;
}

function getLabel(ev) {
  if (ev >= 0.05) return 'SAFE';
  if (ev >= 0.01) return 'RISKY';
  if (ev < 0.01) return 'AVOID';
}

function generateNote(label, ev, confidence, player) {
  if (label === 'SAFE') {
    if (confidence >= 75) return `Strong value on ${player}.`;
    return `Positive EV. ${player} looks solid.`;
  }
  if (label === 'RISKY') return `${player} is playable, but with caution.`;
  if (label === 'AVOID') return `Not enough edge on ${player}.`;
  return '';
}

function analyzeMatch(match) {
  if (!match.oddsPlayer1 || !match.oddsPlayer2) {
    return {
      ...match,
      aiLabel: 'STARTS SOON',
      ev: null,
      confidence: null,
      aiNote: 'Match not live yet.',
    };
  }

  const prob1 = getImpliedProbability(match.oddsPlayer1);
  const prob2 = getImpliedProbability(match.oddsPlayer2);

  const ev1 = calculateEV(prob1, match.oddsPlayer1);
  const ev2 = calculateEV(prob2, match.oddsPlayer2);

  const betterEV = ev1 >= ev2 ? ev1 : ev2;
  const pick = ev1 >= ev2 ? match.player1 : match.player2;

  const label = getLabel(betterEV);
  const confidence = getConfidence(betterEV);
  const note = generateNote(label, betterEV, confidence, pick);

  return {
    ...match,
    aiLabel: label,
    confidence,
    ev: parseFloat(betterEV.toFixed(3)),
    aiNote: note,
  };
}

module.exports = { analyzeMatch };