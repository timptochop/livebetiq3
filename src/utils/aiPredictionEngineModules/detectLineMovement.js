// src/utils/aiPredictionEngineModules/detectLineMovement.js

export default function detectLineMovement(odds) {
  try {
    const bookmakers = odds?.odds?.[0]?.bookmaker;
    if (!Array.isArray(bookmakers) || bookmakers.length < 1) return null;

    const current = bookmakers[0];
    const previous = bookmakers.find((b) => b.$?.id !== current.$?.id);

    const currOdds = [
      parseFloat(current?.odds?.[0]?._),
      parseFloat(current?.odds?.[1]?._),
    ];
    const prevOdds = previous
      ? [
          parseFloat(previous?.odds?.[0]?._),
          parseFloat(previous?.odds?.[1]?._),
        ]
      : null;

    if (!currOdds[0] || !currOdds[1]) return null;

    const drift = {
      home: 0,
      away: 0,
    };

    if (prevOdds && prevOdds[0] && prevOdds[1]) {
      drift.home = currOdds[0] - prevOdds[0];
      drift.away = currOdds[1] - prevOdds[1];
    }

    const movement = drift.home - drift.away;

    return {
      drift,
      movement,
      comment:
        movement > 0.05
          ? 'Home odds rising'
          : movement < -0.05
          ? 'Away odds rising'
          : 'Stable',
    };
  } catch (e) {
    return null;
  }
}