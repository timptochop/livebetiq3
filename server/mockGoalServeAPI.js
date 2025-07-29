// server/mockGoalServeAPI.js
const express = require('express');
const router = express.Router();

const mockTennisData = [
  {
    id: 1,
    player1: "Novak Djokovic",
    player2: "Carlos Alcaraz",
    oddsPlayer1: 1.45,
    oddsPlayer2: 2.80
  },
  {
    id: 2,
    player1: "Rafael Nadal",
    player2: "Daniil Medvedev",
    oddsPlayer1: 1.85,
    oddsPlayer2: 1.95
  },
  {
    id: 3,
    player1: "Tsitsipas",
    player2: "Zverev",
    oddsPlayer1: 2.10,
    oddsPlayer2: 1.75
  },
  {
    id: 4,
    player1: "Jannik Sinner",
    player2: "Holger Rune",
    oddsPlayer1: 1.60,
    oddsPlayer2: 2.30
  },
  {
    id: 5,
    player1: "Andy Murray",
    player2: "Taylor Fritz",
    oddsPlayer1: 2.50,
    oddsPlayer2: 1.55
  }
];

router.get('/live', (req, res) => {
  res.json(mockTennisData);
});

module.exports = router;