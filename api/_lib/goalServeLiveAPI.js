// api/_lib/goalServeLiveAPI.js
// GoalServe Tennis fetcher (GUID key format) + JSON feeds with deterministic fallback.
// Fix: GoalServe expects GUID with dashes in the /getfeed/<KEY>/... path.
// Feeds: home -> d1 -> d2 -> d3 (all with ?json=1)

const READ_TIMEOUT_MS = 15000;

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
  const k =
    process.env.GOALSERVE_KEY ||
    process.env.GOALSERVE_TOKEN ||
    process.env.GOALSERVE_FEED_KEY ||
    "";
  return String(k || "").trim();
}

function normalizeToGuid(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  // Already GUID?
  if (/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(s)) {
    return s.toLowerCase();
  }

  // Raw 32 hex -> GUID
  const hex = s.replace(/[^a-fA-F0-9]/g, "");
  if (hex.length !== 32) return null;

  const guid =
    hex.slice(0, 8) + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" +
    hex.slice(20);

  return guid.toLowerCase();
}

function isLikelyHtml(s) {
  const t = String(s || "").trim().toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("<head") ||
    t.includes("<title") ||
    t.includes("guid should contain")
  );
}

async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  let res;
  let text = "";
  try {
    res = await fetch(url, {
      method: "GET",
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

function buildFeedUrls(guidKey) {
  const base = `https://www.goalserve.com/getfeed/${guidKey}/tennis_scores`;
  return [
    { name: "home", url: `${base}/home?json=1` },
    { name: "d1", url: `${base}/d1?json=1` },
    { name: "d2", url: `${base}/d2?json=1` },
    { name: "d3", url: `${base}/d3?json=1` },
  ];
}

function extractMatchesFromGoalServeJson(data) {
  const scores = data?.scores || data?.data?.scores || data;
  const categories = asArray(scores?.category || scores?.categories);

  const out = [];

  for (const cat of categories) {
    const catName = cat?.name || cat?.["@_name"] || cat?.["@name"] || cat?.id || "Unknown";

    const tournaments = asArray(cat?.tournament || cat?.tournaments);
    const directMatches = asArray(cat?.match || cat?.matches);

    const pushMatch = (m, tournamentName = "") => {
      if (!m) return;
      const id = m?.id || m?.["@_id"] || m?.["@id"] || m?.match_id || m?.gid || null;

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
        players: { p1: String(p1 || "").trim(), p2: String(p2 || "").trim() },
        status: String(status || "").trim(),
        start: { date: String(date || "").trim(), time: String(time || "").trim() },
        category: String(catName || "").trim(),
        tournament: String(tournamentName || "").trim(),
        raw: m,
      });
    };

    for (const t of tournaments) {
      const tName = t?.name || t?.["@_name"] || t?.["@name"] || "";
      const matches = asArray(t?.match || t?.matches);
      for (const m of matches) pushMatch(m, tName);
    }

    for (const m of directMatches) pushMatch(m, "");
  }

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

export async function fetchLiveTennis({ debug = false } = {}) {
  const rawKey = pickEnvKey();
  const guidKey = normalizeToGuid(rawKey);

  const meta = {
    build: "v10.4.0-tennis-live-guidkey-json-fallback",
    now: nowIso(),
    keyPresent: !!rawKey,
    keyLen: rawKey ? rawKey.length : 0,
    keyFormat: guidKey ? "guid" : "invalid",
    normalizedKey: guidKey ? guidKey : null,
  };

  if (!rawKey) {
    return {
      ok: false,
      mode: "ERROR",
      matches: [],
      meta: { ...meta, error: "missing_env_GOALSERVE_KEY_or_GOALSERVE_TOKEN" },
    };
  }

  if (!guidKey) {
    return {
      ok: false,
      mode: "ERROR",
      matches: [],
      meta: { ...meta, error: "invalid_key_format_expected_32hex_or_guid" },
    };
  }

  const urls = buildFeedUrls(guidKey);

  const tried = [];
  for (const u of urls) {
    const r = await fetchText(u.url);
    tried.push({
      name: u.name,
      url: u.url,
      status: r.status,
      ok: r.ok,
      contentType: r.contentType,
      head: String(r.text || "").slice(0, 260),
    });

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
            rawHead: String(r.text || "").slice(0, 900),
          },
          tried,
        },
        debug: debug ? { tried } : undefined,
      };
    }

    const json = safeJsonParse(r.text);
    if (!json) continue;

    const matches = extractMatchesFromGoalServeJson(json);
    const counts = computeCounts(matches);

    if (matches.length === 0) continue;

    return {
      ok: true,
      mode: u.name === "home" ? "LIVE" : "FALLBACK",
      matches,
      meta: { ...meta, source: u.name, counts, tried },
      debug: debug ? { sourceUrl: u.url, counts, tried } : undefined,
    };
  }

  return {
    ok: true,
    mode: "EMPTY",
    matches: [],
    meta: {
      ...meta,
      counts: { live: 0, upcoming: 0, total: 0 },
      tried,
      note: "All feeds returned JSON but yielded 0 matches (can be normal off-hours).",
    },
    debug: debug ? { tried } : undefined,
  };
}