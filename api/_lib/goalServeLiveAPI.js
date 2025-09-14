// api/_lib/goalServeLiveAPI.js
import axios from 'axios';

// Διαβάζουμε ΚΑΙ GOALSERVE_TOKEN ΚΑΙ GOALSERVE_KEY (σου αρκεί να έχεις το πρώτο στο Vercel)
const TOKEN = process.env.GOALSERVE_TOKEN || process.env.GOALSERVE_KEY || '';
const URL = `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${TOKEN}`;

export async function fetchLiveTennis() {
  // 1) Έλεγχος token
  if (!TOKEN) {
    return { ok: false, error: 'Missing GOALSERVE_TOKEN (set it in Vercel -> Settings -> Environment Variables).' };
  }

  // 2) Κλήση GoalServe (JSON)
  let resp;
  try {
    resp = await axios.get(URL, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
      validateStatus: () => true,
      transformResponse: [(data) => {
        // Μπορεί να έρθει string, Buffer ή ήδη object
        try {
          if (typeof data === 'string') return JSON.parse(data);
          if (data && typeof data === 'object') return data;
          return data;
        } catch {
          return data;
        }
      }],
    });
  } catch (e) {
    return { ok: false, error: `Network error to GoalServe: ${e.message}` };
  }

  // 3) HTTP status από GoalServe
  if (resp.status >= 400) {
    // Συχνά 401/403 αν το token δεν είναι ενεργό
    return { ok: false, error: `GoalServe HTTP ${resp.status}`, bodyType: typeof resp.data };
  }

  // 4) Δομή δεδομένων
  const data = resp.data;
  if (!data || !data.scores) {
    return { ok: false, error: 'GoalServe response has no "scores"', bodyType: typeof data };
  }

  const cats = Array.isArray(data.scores.category)
    ? data.scores.category
    : (data.scores.category ? [data.scores.category] : []);

  const matches = [];
  for (const cat of cats) {
    const tournament = cat?.name || cat?.category || 'Unknown Tournament';
    const list = Array.isArray(cat.match) ? cat.match : (cat.match ? [cat.match] : []);

    for (const m of list) {
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

  return { ok: true, matches };
}