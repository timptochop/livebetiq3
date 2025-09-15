// api/_lib/goalServeLiveAPI.js
import axios from 'axios';

const TOKEN = process.env.GOALSERVE_TOKEN || process.env.GOALSERVE_KEY || '';

/**
 * Τραβάμε live tennis από GoalServe.
 * Προσπαθούμε πρώτα το JSON endpoint, μετά το κλασικό.
 * Επιστρέφουμε ΠΑΝΤΑ { matches: [...] } και, αν κάτι πάει στραβά, γεμίζουμε το error.
 */
export async function fetchLiveTennis() {
  if (!TOKEN) {
    return { matches: [], error: 'MISSING_TOKEN' };
  }

  const urls = [
    `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${TOKEN}`,
    `https://www.goalserve.com/getfeed/tennis_scores/home/?key=${TOKEN}`,
  ];

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    // βοηθάει σε μερικούς providers
    'User-Agent': 'livebetiq3/1.0 (+vercel; tennis-live)',
  };

  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers,
        // μην πετάς exception για 4xx — μόνο για 5xx/δίκτυο
        validateStatus: (s) => s < 500,
      });

      if (res.status >= 400) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }

      const raw = res.data;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

      const categories = data?.scores?.category ?? [];
      const catList = Array.isArray(categories) ? categories : [categories];

      const matches = [];
      for (const cat of catList) {
        const tournament =
          cat?.name || cat?.$?.name || cat?.['@name'] || 'Unknown Tournament';

        const matchList = cat?.match ?? [];
        const matchArr = Array.isArray(matchList) ? matchList : [matchList];

        for (const m of matchArr) {
          const players = m?.player ?? m?.players ?? [];
          const p0 = Array.isArray(players) ? players[0] : players?.[0] ?? {};
          const p1 = Array.isArray(players) ? players[1] : players?.[1] ?? {};

          const home = p0?.name || p0?._ || p0 || '';
          const away = p1?.name || p1?._ || p1 || '';

          matches.push({
            id: m?.id || m?.['@id'] || `${tournament}-${home}-${away}-${m?.time || ''}`,
            tournament,
            home,
            away,
            status: m?.status || m?.['@status'] || '',
            time: m?.time || m?.['@time'] || '',
            odds: m?.odds ?? null,
            raw: m,
          });
        }
      }

      return { matches, meta: { source: url } };
    } catch (e) {
      lastErr = e;
    }
  }

  return {
    matches: [],
    error: (lastErr && (lastErr.message || String(lastErr))) || 'FETCH_FAILED',
  };
}