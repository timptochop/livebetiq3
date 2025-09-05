// src/utils/aiPredictionEngineModules/generateNote.js

export default function generateNote({ label, player1, player2 }) {
  if (label === 'SAFE') return `TIP: ${player1}`;
  if (label === 'RISKY') return `Possible edge for ${player1}`;
  if (label === 'AVOID') return `Avoid betting this match`;
  return '';
}