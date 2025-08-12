// src/utils/telemetry.js
const API =
  (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) ||
  '/api';

export async function logPrediction(m) {
  try {
    await fetch(`${API}/log-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: m.id,
        player1: m.player1,
        player2: m.player2,
        currentSet: m.currentSet,
        ev: m.ev,
        confidence: m.confidence,
        label: m.aiLabel,
        odds1: m.odds1,
        odds2: m.odds2,
        form: m.form,
        momentum: m.momentum,
        h2h: m.h2h,
        surfaceFit: m.surfaceFit,
        fatigue: m.fatigue,
        volatility: m.volatility,
      }),
    });
  } catch {
    /* no-op */
  }
}

export async function logOutcome({ id, winner, sets }) {
  try {
    await fetch(`${API}/log-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, winner, sets }),
    });
  } catch {
    /* no-op */
  }
}