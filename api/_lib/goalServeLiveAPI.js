// File: api/_lib/goalServeLiveAPI.js
// Node 18+ (fetch διαθέσιμο). Δεν χρειάζεται axios/xml2js/zlib.

const UA =
  "LiveBetIQ/0.97 (+https://vercel.app) Mozilla/5.0; support: livebetiq";

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function pick(...xs) {
  for (const x of xs) if (x !== undefined && x !== null && x !== "") return x;
  return "";
}

function extractFromJSON(root) {
  const out = [];
  const scores = root?.scores;
  if (!scores) return out;

  const categories = asArray(scores.category);
  for (const cat of categories) {
    const tournament =
      pick(cat?.name, cat?.["@name"], cat?.$?.name) || "Unknown Tournament";
    const matches = asArray(cat?.match);

    for (const m of matches) {
      // Παίχτες (πολλές παραλλαγές στα feeds)
      const players = asArray(m?.player);
      const p1 = players[0] ?? {};
      const p2 = players[1] ?? {};

      const name1 = pick(
        p1?._,
        p1?.name,
        p1?.["@name"],
        m?.home,
        m?.home_name,
        m?.player1
      );
      const name2 = pick(
        p2?._,
        p2?.name,
        p2?.["@name"],
        m?.away,
        m?.away_name,
        m?.player2
      );

      out.push({
        id: pick(m?.id, m?.["@id"], `${tournament}-${name1}-${name2}`),
        tournament,
        home: name1,
        away: name2,
        status: pick(m?.status, m?.["@status"], ""),
        time: pick(m?.time, m?.["@time"], ""),
        raw: m,
      });
    }
  }
  return out;
}

export async function fetchGoalServeLive({ debug = false } = {}) {
  const key = process.env.GOALSERVE_KEY || process.env.GOALSERVE_TOKEN || "";
  if (!key) {
    return {
      matches: [],
      error: "Missing GOALSERVE_KEY/GOALSERVE_TOKEN",
      meta: debug ? { note: "set one env var on Vercel" } : undefined,
    };
  }

  // Δοκιμάζουμε ΚΑΙ τις 2 παραλλαγές (μερικά accounts «θέλουν» τη σειρά των query params)
  const urls = [
    `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${key}`,
    `https://www.goalserve.com/getfeed/tennis_scores/home/?key=${key}&json=1`,
  ];

  let lastErr = null;
  let lastStatus = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json,text/plain,*/*",
        },
      });

      lastStatus = res.status;

      if (!res.ok) {
        lastErr = `${res.status} ${res.statusText}`;
        continue; // δοκίμασε το επόμενο url
      }

      // Περιμένουμε JSON (με ?json=1)
      const data = await res.json();
      const matches = extractFromJSON(data);
      return {
        matches,
        meta: debug ? { source: "json", urlTried: [url] } : undefined,
      };
    } catch (e) {
      lastErr = e?.message || "unknown error";
      // συνέχισε στο επόμενο URL
    }
  }

  return {
    matches: [],
    error: lastErr || `HTTP ${lastStatus || "?"}`,
    meta: debug ? { urlTried: urls } : undefined,
  };
}