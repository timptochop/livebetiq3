// src/utils/fetchTennisLive.js
import { buildOddsIndex } from './oddsParser';

export default async function fetchTennisLive(opts = {}) {
  const { signal } = opts;

  const url = `/api/gs/tennis-live?ts=${Date.now()}`;

  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
  });

  if (!res.ok) {
    throw new Error(`[fetchTennisLive] http ${res.status}`);
  }

  const json = await res.json();
  const matches = Array.isArray(json && json.matches) ? json.matches : [];

  let enriched = matches;

  try {
    const oddsRes = await fetch('/api/gs/tennis-odds', {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (oddsRes.ok) {
      const oddsJson = await oddsRes.json();
      if (oddsJson && oddsJson.ok && oddsJson.raw) {
        const oddsIndex = buildOddsIndex(oddsJson);

        enriched = matches.map((m) => {
          const rawId =
            m.id ??
            m.matchId ??
            m.matchid ??
            m['@id'] ??
            null;

          const matchId = rawId != null ? String(rawId).trim() : '';
          if (!matchId) {
            return m;
          }

          const odds = oddsIndex[matchId];
          if (!odds) {
            return m;
          }

          return {
            ...m,
            favName: odds.favName || m.favName,
            favOdds: odds.favOdds ?? m.favOdds,
            homeOdds: odds.homeOdds ?? m.homeOdds,
            awayOdds: odds.awayOdds ?? m.awayOdds,
            odds: {
              ...(m.odds || {}),
              ...odds,
            },
          };
        });
      }
    }
  } catch (err) {
    console.error('[fetchTennisLive] odds fetch failed', err);
  }

  return enriched;
}