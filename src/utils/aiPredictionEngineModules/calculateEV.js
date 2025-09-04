// calculateEV.js
// Υπολογισμός Expected Value (EV) για έναν παίκτη με βάση τις πιθανότητες νίκης (prob) και τις αποδόσεις (odds)

export default function calculateEV(prob, odds) {
  if (!Number.isFinite(prob) || !Number.isFinite(odds) || prob <= 0 || odds <= 1) {
    return 0; // fallback σε μη έγκυρες τιμές
  }

  // Υπολογισμός Expected Value: EV = (probability * (odds - 1)) - (1 - probability)
  const ev = (prob * (odds - 1)) - (1 - prob);

  return Math.round(ev * 1000) / 1000; // 3 δεκαδικά ψηφία
}