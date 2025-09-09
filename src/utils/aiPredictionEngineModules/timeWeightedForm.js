// src/utils/aiPredictionEngineModules/timeWeightedForm.js

/**
 * Calculates time-weighted form for both players based on mock recent results.
 * In production, replace with real historical match data API.
 */
export default async function timeWeightedForm(home, away) {
  const mockRecentMatches = {
    [home]: [
      { result: 'W', daysAgo: 10 },
      { result: 'L', daysAgo: 25 },
      { result: 'W', daysAgo: 45 },
    ],
    [away]: [
      { result: 'L', daysAgo: 5 },
      { result: 'W', daysAgo: 15 },
      { result: 'L', daysAgo: 50 },
    ],
  };

  const calculateFormScore = (matches) => {
    return matches.reduce((score, match) => {
      const weight =
        match.daysAgo <= 30
          ? 1
          : match.daysAgo <= 60
          ? 0.5
          : 0.1; // decay over time
      return score + (match.result === 'W' ? 1 : -1) * weight;
    }, 0);
  };

  const homeForm = calculateFormScore(mockRecentMatches[home] || []);
  const awayForm = calculateFormScore(mockRecentMatches[away] || []);

  return { homeForm, awayForm };
}