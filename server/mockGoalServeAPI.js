const express = require('express');
const router = express.Router();

// Mock tennis match data
const mockMatches = [
  {
    id: 1,
    player1: 'Novak Djokovic',
    player2: 'Carlos Alcaraz',
    aiLabel: 'SAFE',
    ev: 0.045,
    confidence: 68,
    aiNote: 'Djokovic on serve streak, high confidence win expected.',
  },
  {
    id: 2,
    player1: 'Jannik Sinner',
    player2: 'Stefanos Tsitsipas',
    aiLabel: 'RISKY',
    ev: 0.026,
    confidence: 58,
    aiNote: 'Sinner slightly ahead, but volatility remains.',
  },
  {
    id: 3,
    player1: 'Rafael Nadal',
    player2: 'Daniil Medvedev',
    aiLabel: 'STARTS SOON',
    ev: null,
    confidence: null,
    aiNote: 'Match has not started yet.',
  }
];

// Define the GET endpoint
router.get('/live', (req, res) => {
  res.json(mockMatches);
});

module.exports = router;