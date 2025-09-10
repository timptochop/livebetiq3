export default function analyzeMatch(match) {
  const ev = Math.random() * 0.1 - 0.05;
  const confidence = Math.floor(40 + Math.random() * 40);
  const label =
    ev > 0.025 && confidence > 60
      ? 'SAFE'
      : ev > 0 && confidence > 50
      ? 'RISKY'
      : 'AVOID';

  const tip = label === 'SAFE' ? match.player1 : null;

  return {
    ev: ev.toFixed(3),
    confidence,
    label,
    tip,
  };
}