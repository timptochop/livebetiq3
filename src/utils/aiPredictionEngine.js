// aiPredictionEngine.js v1.1.0
// Περιλαμβάνει: EV, Confidence, Labeling, Reason, Kelly

// 🧮 Υπολογισμός Expected Value (EV)
export function calculateEV(prob, odds) {
  return (odds * prob) - 1;
}

// 📈 Εκτίμηση Confidence (με βάση EV και odds ratio)
export function estimateConfidence(ev, better, worse) {
  const odds1 = parseFloat(better.odds) || 1;
  const odds2 = parseFloat(worse.odds) || 1;

  const oddsRatio = odds1 / odds2;
  let confidence = 50 + (ev * 100) + (Math.log2(oddsRatio) * 5);

  return Math.max(40, Math.min(99, confidence));
}

// 🧠 Δημιουργία Label
export function generateLabel(ev, confidence) {
  if (ev >= 0.025 && confidence >= 60) return 'SAFE';
  if (ev >= 0.010 && confidence >= 52) return 'RISKY';
  return 'AVOID';
}

// 💬 Δημιουργία αιτιολόγησης
export function generateNote(label, ev, confidence, pick) {
  if (label === 'SAFE') return `Strong edge on ${pick}`;
  if (label === 'RISKY') return `Small edge on ${pick}`;
  if (label === 'AVOID') return `No value found`;
  return '';
}

// 💸 Υπολογισμός Kelly Criterion
export function calculateKelly(ev, confidence) {
  const c = confidence / 100;
  return Math.max(0, (ev / (1 + ev)) * c);
}