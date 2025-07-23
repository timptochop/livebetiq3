// server/mockGoalServeAPI.js
const express = require('express');
const app = express();
const PORT = 5000;

const mockTennisData = [
  {
    id: 1,
    player1: "Novak Djokovic",
    player2: "Carlos Alcaraz",
    set: 3,
    gameScore: "4-3",
    oddsPlayer1: 1.45,
    oddsPlayer2: 2.80,
    aiLabel: "SAFE"
  },
  {
    id: 2,
    player1: "Rafael Nadal",
    player2: "Daniil Medvedev",
    set: 3,
    gameScore: "5-2",
    oddsPlayer1: 1.70,
    oddsPlayer2: 2.10,
    aiLabel: "RISKY"
  }
];

app.get('/api/tennis/live', (req, res) => {
  res.json(mockTennisData);
});

app.listen(PORT, () => {
  console.log(`🎾 Mock GoalServe API running at http://localhost:${PORT}/api/tennis/live`);
});