// server/mockGoalServeAPI.js
const express = require('express');
const app = express();
const PORT = 5000;

const mockTennisData = [
  {
    id: 1,
    player1: "Novak Djokovic",
    player2: "Carlos Alcaraz",
    oddsPlayer1: 1.45,
    oddsPlayer2: 2.80,
    aiLabel: "SAFE",
    confidence: 72,
    ev: 0.054,
    aiNote: "Momentum strong. Safe pick for Novak."
  },
  {
    id: 2,
    player1: "Rafael Nadal",
    player2: "Daniil Medvedev",
    oddsPlayer1: 1.85,
    oddsPlayer2: 1.95,
    aiLabel: "RISKY",
    confidence: 58,
    ev: 0.027,
    aiNote: "High volatility. Watch for tie-break."
  },
  {
    id: 3,
    player1: "Tsitsipas",
    player2: "Zverev",
    oddsPlayer1: 2.10,
    oddsPlayer2: 1.75,
    aiLabel: "AVOID",
    confidence: 44,
    ev: -0.015,
    aiNote: "Low edge. Best avoided."
  },
  {
    id: 4,
    player1: "Jannik Sinner",
    player2: "Holger Rune",
    oddsPlayer1: 1.60,
    oddsPlayer2: 2.30,
    aiLabel: "STARTS SOON",
    confidence: null,
    ev: null,
    aiNote: "Match has not started yet."
  }
];

app.get('/api/tennis/live', (req, res) => {
  res.json(mockTennisData);
});

app.listen(PORT, () => {
  console.log(`Mock GoalServe API running at http://localhost:${PORT}/api/tennis/live`);
});