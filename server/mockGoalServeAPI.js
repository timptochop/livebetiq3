const express = require('express');
const app = express();
const PORT = 5000;

const mockTennisData = [
  {
    id: 1,
    player1: "Djokovic",
    player2: "Alcaraz",
    ev: 0.042,
    confidence: 68,
    aiLabel: "SAFE",
    aiNote: "Strong form and high win probability"
  },
  {
    id: 2,
    player1: "Tsitsipas",
    player2: "Zverev",
    ev: 0.027,
    confidence: 60,
    aiLabel: "RISKY",
    aiNote: "Tight matchup, watch live momentum"
  },
  {
    id: 3,
    player1: "Nadal",
    player2: "Medvedev",
    ev: 0.008,
    confidence: 48,
    aiLabel: "AVOID",
    aiNote: "Low value, high uncertainty"
  },
  {
    id: 4,
    player1: "Rublev",
    player2: "Sinner",
    ev: 0.015,
    confidence: 54,
    aiLabel: "STARTS SOON",
    aiNote: "Match not started yet"
  },
  {
    id: 5,
    player1: "Rune",
    player2: "Thiem",
    ev: 0.030,
    confidence: 61,
    aiLabel: "RISKY",
    aiNote: "Moderate edge based on odds"
  }
];

app.get('/api/tennis/live', (req, res) => {
  res.json(mockTennisData);
});

app.listen(PORT, () => {
  console.log(`🎾 Mock GoalServe API running at http://localhost:${PORT}/api/tennis/live`);
});