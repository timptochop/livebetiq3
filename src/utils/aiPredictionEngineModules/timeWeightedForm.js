export default function timeWeightedForm(playerStats = []) {
  let score = 0;
  let totalWeight = 0;

  for (const match of playerStats) {
    const date = new Date(match.date);
    const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

    let weight = 0;
    if (daysAgo <= 30) weight = 1.0;
    else if (daysAgo <= 60) weight = 0.5;
    else if (daysAgo <= 90) weight = 0.25;
    else continue;

    const outcome = match.result === 'win' ? 1 : match.result === 'loss' ? -1 : 0;
    score += outcome * weight;
    totalWeight += weight;
  }

  return totalWeight ? score / totalWeight : 0;
}