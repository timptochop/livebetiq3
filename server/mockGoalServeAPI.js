// server/mockGoalServeAPI.js
const express = require('express');
const router = express.Router();

const mockTennisData = [
  {
    id: 1,
    player1: "Djokovic",
    player2: "Alcaraz",
    oddsPlayer1: 1.40,
    oddsPlayer2: 3.00 // EV: HIGH, CONF: HIGH → SAFE
  },
  {
    id: 2,
    player1: "Nadal",
    player2: "Medvedev",
    oddsPlayer1: 2.00,
    oddsPlayer2: 1.80 // EV: medium, CONF: medium → RISKY
  },
  {
    id: 3,
    player1: "Tsitsipas",
    player2: "Zverev",
    oddsPlayer1: 1.80,
    oddsPlayer2: 1.85 // EV: low, CONF: low → AVOID
  },
  {
    id: 4,
    player1: "Rune",
    player2: "Sinner",
    oddsPlayer1: 2.50,
    oddsPlayer2: 1.55 // EV: very low, no prediction → STARTS SOON
  },
  {
    id: 5,
    player1: "Murray",
    player2: "Fritz",
    oddsPlayer1: 1.60,
    oddsPlayer2: 2.30 // EV: medium, CONF: high → RISKY
  },
  {
    id: 6,
    player1: "Thiem",
    player2: "Rublev",
    oddsPlayer1: 1.95,
    oddsPlayer2: 1.90 // EV: balanced → AVOID
  },
  {
    id: 7,
    player1: "Kyrgios",
    player2: "Berrettini",
    oddsPlayer1: 1.45,
    oddsPlayer2: 2.80 // EV: high, CONF: medium → SAFE
  }
];

router.get('/live', (req, res) => {
  res.json(mockTennisData);
});

module.exports = router;