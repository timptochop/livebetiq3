// api/_lib/goalServeLiveAPI.js
// GoalServe Tennis fetcher (JSON-first) with deterministic fallback:
// home -> d1 -> d2 -> d3
// IMPORTANT: GoalServe "getfeed/<KEY>/tennis_scores/..." uses RAW 32-hex key (NO GUID dashes).
// Adds ?json=1 as GoalServe recommends.

const READ_TIMEOUT_MS = 14000;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function pickEnvKey() {
  // Support both names (you have both in Vercel)
  const k =
    process.env.GOALSERVE_KEY ||
    process.env.GOALSERVE_TOKEN ||
    process.env.GOALSERVE_FEED_KEY ||
    "";
  return String(k || "").trim();
}

function isLikelyHtml(s) {
  const t = String(s || "").trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head") || t.includes("<title");
}

async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  let res;
  let text = "";
  try {
    res = await fetch(url, {
      method: "GET",
      // Avoid fancy headers; GoalServe can be picky. Keep it simple.
      headers: {
        "User-Agent": "livebetiq3-vercel/tennis-live",
        "Accept": "application/json,text/plain,*/*",
      },
      signal: ctl.signal,
    });
    text = await res.text();
  } finally {
    clearTimeout(to);
  }

  const contentType = res?.headers?.get?.("content-type") || "";
  return {
    ok: !!res?.ok,
    status: res?.status || 0,
    contentType,
    text,
    url,
  };
}

function buildFeedUrls(rawKey) {
  // Based on the GoalServe document you uploaded  [oai_citation:1‡15.12 API feeds_urls 7.txt](sediment://file_000000007c0471fd86404bbb383209fd)
  const base = `https://www.goalserve.com/getfeed/${rawKey}/tennis_scores`;
  return [
    { name: "home", url: `${base}/home?json=1` }, // live score
    { name: "d1", url: `${base}/d1?json=1` },     // tomorrow
    { name: "d2", url: `${base}/d2?json=1` },     // +2 days
    { name: "d3", url: `${base}/d3?json=1` },     // +3 days
  ];
}

/**
 * Tries to extract a flat list of matches from GoalServe tennis_scores JSON.
 * We keep normalization minimal and resilient.
 */
function extractMatchesFromGoalServeJson(data) {
  // Known common layout: { scores: { category: [...] } }
  const scores = data?.scores || data?.data?.scores || data;
  const categories = asArray(scores?.category || scores?.categories);

  const out = [];

  for (const cat of categories) {
    const catName = cat?.name || cat?.["@_name"] || cat?.["@name"] || cat?.id || "Unknown";
    const tournaments = asArray(cat?.tournament || cat?.tournaments || cat);

    // Sometimes tournament is nested, sometimes matches are directly under category
    const directMatches = asArray(cat?.match || cat?.matches);

    const pushMatch = (m, tournamentName = "") => {
      if (!m) return;
      const id = m?.id || m?.["@_id"] || m?.["@id"] || m?.match_id || m?.gid || null;

      // Players can appear in different shapes
      const p1 =
        m?.player1?.name ||
        m?.player1 ||
        m?.home?.name ||
        m?.home ||
        m?.team1 ||
        m?.["player1_name"] ||
        "";
      const p2 =
        m?.player2?.name ||
        m?.player2 ||
        m?.away?.name ||
        m?.away ||
        m?.team2 ||
        m?.["player2_name"] ||
        "";

      const status =
        m?.status ||
        m?.["@_status"] ||
        m?.["@status"] ||
        m?.["match_status"] ||
        "";

      const date =
        m?.date ||
        m?.["@_date"] ||
        m?.["@date"] ||
        "";
      const time =
        m?.time ||
        m?.["@_time"] ||
        m?.["@time"] ||
        "";

      out.push({
        id: id ? String(id) : null,
        players: {
          p1: String(p1 || "").trim(),
          p2: String(p2 || "").trim(),
        },
        status: String(status || "").trim(),
        start: { date: String(date || "").trim(), time: String(time || "").trim() },
        category: String(catName || "").trim(),
        tournament: String(tournamentName || "").trim(),
        raw: m, // keep for debugging / AI parsing if needed
      });
    };

    // Tournament-level matches
    for (const t of tournaments) {
      const tName = t?.name || t?.["@_name"] || t?.["@name"] || "";
      const matches = asArray(t?.match || t?.matches);
      for (const m of matches) pushMatch(m, tName);
    }

    // Category-level direct matches
    for (const m of directMatches) pushMatch(m, "");
  }

  // Fallback: if JSON is already an array of matches
  if (!out.length && Array.isArray(data)) {
    for (const m of data) {
      out.push({
        id: m?.id ? String(m.id) : null,
        players: { p1: String(m?.player1 || m?.p1 || ""), p2: String(m?.player2 || m?.p2 || "") },
        status: String(m?.status || ""),
        start: { date: String(m?.date || ""), time: String(m?.time || "") },
        category: "",
        tournament: "",
        raw: m,
      });
    }
  }

  // Remove empties
  return out.filter((m) => (m.players?.p1 && m.players?.p2) || m.id);
}

function computeCounts(matches) {
  let live = 0;
  let upcoming = 0;

  for (const m of matches) {
    const s = String(m?.status || "").toLowerCase();
    if (s.includes("live") || s.includes("in play") || s.includes("inplay")) live++;
    else if (s.includes("not started") || s.includes("scheduled") || s.includes("upcoming")) upcoming++;
  }

  return { live, upcoming, total: matches.length };
}

/**
 * Main public function used by /api/gs/tennis-live
 */
export async function fetchLiveTennis({ debug = false } = {}) {
  const rawKey = pickEnvKey();

  const meta = {
    build: "v10.3.0-tennis-live-rawkey-json-fallback",
    now: nowIso(),
    keyPresent: !!rawKey,
    keyLen: rawKey ? rawKey.length : 0,
  };

  if (!rawKey) {
    return {
      ok: false,
      mode: "ERROR",
      matches: [],
      meta: { ...meta, error: "missing_env_GOALSERVE_KEY_or_GOALSERVE_TOKEN" },
    };
  }

  const urls = buildFeedUrls(rawKey);

  const tried = [];
  for (const u of urls) {
    const r = await fetchText(u.url);
    tried.push({
      name: u.name,
      url: u.url,
      status: r.status,
      ok: r.ok,
      contentType: r.contentType,
      head: String(r.text || "").slice(0, 220),
    });

    // If upstream returned HTML, this is a hard fail: wrong endpoint or blocked
    if (isLikelyHtml(r.text) || String(r.contentType).toLowerCase().includes("text/html")) {
      return {
        ok: true,
        mode: "EMPTY",
        matches: [],
        meta: {
          ...meta,
          error: "upstream_returned_html_instead_of_json",
          upstream: {
            ok: false,
            status: r.status,
            contentType: r.contentType,
            urlTried: u.url,
            rawHead: String(r.text || "").slice(0, 700),
          },
          tried,
        },
        debug: debug ? { tried } : undefined,
      };
    }

    const json = safeJsonParse(r.text);
    if (!json) {
      // Not JSON, keep trying next url
      continue;
    }

    const matches = extractMatchesFromGoalServeJson(json);
    const counts = computeCounts(matches);

    // If home has nothing, we fallback to d1/d2/d3
    if (matches.length === 0) {
      continue;
    }

    return {
      ok: true,
      mode: u.name === "home" ? "LIVE" : "FALLBACK",
      matches,
      meta: {
        ...meta,
        source: u.name,
        counts,
        tried,
      },
      debug: debug
        ? {
            sourceUrl: u.url,
            counts,
            tried,
          }
        : undefined,
    };
  }

  // If we reach here: all feeds returned JSON but no matches (can happen off-hours)
  return {
    ok: true,
    mode: "EMPTY",
    matches: [],
    meta: {
      ...meta,
      counts: { live: 0, upcoming: 0, total: 0 },
      tried,
      note:
        "All feeds returned JSON but yielded 0 matches. This can be normal when there are no events in the chosen windows.",
    },
    debug: debug ? { tried } : undefined,
  };
}