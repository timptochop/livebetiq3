import axios from 'axios';

const GOALSERVE_TOKEN =
  process.env.GOALSERVE_TOKEN || process.env.GOALSERVE_KEY || '';

if (!GOALSERVE_TOKEN) {
  console.error('[GS] No GOALSERVE_TOKEN/GOALSERVE_KEY set');
}

// Χρησιμοποιούμε το JSON endpoint (όχι XML/Gzip) για σταθερότητα
const GOALSERVE_URL =
  `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${GOALSERVE_TOKEN}`;

export async function fetchLiveTennis() {
  try {
    const { data } = await axios.get(GOALSERVE_URL, { timeout: 15000 });

    if (!data || !data.scores) {
      console.error('[GS] Invalid response shape');
      return { matches: [] };
    }

    const categories = Array.isArray(data.scores.category)
      ? data.scores.category
      : (data.scores.category ? [data.scores.category] : []);

    const matches = [];
    for (const cat of categories) {
      const tournament = cat?.$?.name || cat?.name || 'Unknown';
      const list = Array.isArray(cat.match) ? cat.match : (cat.match ? [cat.match] : []);
      for (const m of list) {
        const p = m?.player || [];
        const home = p?.[0]?._ || p?.[0] || '';
        const away = p?.[1]?._ || p?.[1] || '';
        matches.push({
          id: m?.id || '',
          tournament,
          home,
          away,
          status: m?.status || '',
          time: m?.time || '',
          odds: m?.odds ?? null,
          raw: m,
        });
      }
    }

    console.log(`[GS] ✅ Fetched ${matches.length} matches`);
    return { matches };
  } catch (err) {
    console.error('[GS] Request failed:', err?.response?.status || err.message);
    return { matches: [] };
  }
}