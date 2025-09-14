// api/_lib/goalServeLiveAPI.js
import axios from 'axios';

// Διαβάζουμε ΚΑΙ τα δύο πιθανά env names, προτιμάμε GOALSERVE_TOKEN
const GOALSERVE_TOKEN =
  process.env.GOALSERVE_TOKEN || process.env.GOALSERVE_KEY;

if (!GOALSERVE_TOKEN) {
  // Θα φανεί καθαρά στα function logs αν λείπει
  console.warn('[GoalServe] Missing GOALSERVE_TOKEN / GOALSERVE_KEY');
}

const GOALSERVE_URL = `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${GOALSERVE_TOKEN}`;

export async function fetchLiveTennis() {
  if (!GOALSERVE_TOKEN) {
    throw new Error('Missing GOALSERVE_TOKEN (set it in Vercel env vars).');
  }

  const resp = await axios.get(GOALSERVE_URL, {
    headers: { Accept: 'application/json' },
    timeout: 10000,
    // σε κάποια responses το content-type δεν είναι σωστό -> προσπαθούμε να κάνουμε parse χειροκίνητα
    transformResponse: [(data) => {
      try { return typeof data === 'string' ? JSON.parse(data) : data; }
      catch { return data; }
    }],
    validateStatus: () => true, // να μη ρίχνει εξαίρεση αυτόματα
  });

  if (resp.status >= 400) {
    throw new Error(`GoalServe HTTP ${resp.status}`);
  }

  const data = resp.data;
  if (!data || !data.scores) {
    throw new Error('GoalServe response has no "scores"');
  }

  // Η δομή του JSON δίνει είτε array είτε single object
  const cats = Array.isArray(data.scores.category)
    ? data.scores.category
    : (data.scores.category ? [data.scores.category] : []);

  const matches = [];
  for (const cat of cats) {
    const tournament = cat?.name || cat?.category || 'Unknown Tournament';
    const list = Array.isArray(cat.match) ? cat.match : (cat.match ? [cat.match] : []);

    for (const m of list) {
      // Τα πεδία παίζουν λίγο – κρατάμε τα πιο συνηθισμένα
      const p = Array.isArray(m.player) ? m.player : [];
      const home = p[0]?._ || p[0] || m.home || m.player1 || '';
      const away = p[1]?._ || p[1] || m.away || m.player2 || '';
      matches.push({
        id: m.id || m.matchid || `${tournament}-${home}-${away}-${m.time || ''}`,
        tournament,
        home,
        away,
        status: m.status || '',
        time: m.time || '',
        odds: m.odds ?? null,
        raw: m,
      });
    }
  }

  return { matches };
}