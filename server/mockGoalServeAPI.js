// server/mockGoalServeAPI.js
const express = require('express');
const router = express.Router();
const { analyzeMatch } = require('./aiEngine');

const rawMatches = [
  {
    id: 1,
    player1: "Novak Djokovic",
    player2: "Carlos Alcaraz",
    oddsPlayer1: 1.50,
    oddsPlayer2: 2.60
  },
  {
    id: 2,
    player1: "Rafael Nadal",
    player2: "Daniil Medvedev",
    oddsPlayer1: 1.90,
    oddsPlayer2: 1.90
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
    oddsPlayer1: null,
    oddsPlayer2: null // simulates "STARTS SOON"
  }
];

router.get('/live', (req, res) => {
  const processedMatches = rawMatches.map(analyzeMatch);
  res.json(processedMatches);
});

module.exports = router;