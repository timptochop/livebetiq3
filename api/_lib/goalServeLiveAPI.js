// /api/_lib/goalServeLiveAPI.js
// Robust GoalServe fetcher + JSON guards + normalizers
// Exports:
//   - fetchLiveTennisRaw, fetchLiveTennis
//   - fetchTennisOddsRaw, fetchTennisOdds
//   - fetchPredictions  (FIX for /api/gs/tennis-predictions)

const READ_TIMEOUT_MS = 12000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": "livebetiq/1.0",
        Connection: "close",
      },
      cache: "no-store",
      signal: ctl.signal,
    });

    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(to);
  }
}

function safeJsonParse(text) {
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function toArr(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}

/** normalize GoalServe tennis_scores JSON -> flat matches[] */
function normalizeGoalServeScores(json) {
  const categories = toArr(json?.scores?.category);
  const out = [];

  for (const cat of categories) {
    const catName = cat?.["@name"] || cat?.name || "";
    const catId = cat?.["@id"] || cat?.id || "";

    const matches = toArr(cat?.match);

    for (const m of matches) {
      const players = toArr(m?.player).map((p) => ({
        id: p?.["@id"] ?? p?.id ?? "",
        name: p?.["@name"] ?? p?.name ?? "",
        s1: p?.["@s1"] ?? p?.s1 ?? "",
        s2: p?.["@s2"] ?? p?.s2 ?? "",
        s3: p?.["@s3"] ?? p?.s3 ?? "",
        s4: p?.["@s4"] ?? p?.s4 ?? "",
        s5: p?.["@s5"] ?? p?.s5 ?? "",
      }));

      out.push({
        id: m?.["@id"] || m?.id || "",
        date: m?.["@date"] || m?.date || "",
        time: m?.["@time"] || m?.time || "",
        status: m?.["@status"] || m?.status || "",
        categoryId: catId,
        categoryName: catName,
        players,
      });
    }
  }

  return out;
}

/**
 * Find match objects that have: { id: "...", odds: {...} }
 * GoalServe getodds is nested and inconsistent; we walk recursively.
 */
function collectOddsNodes(node, acc = []) {
  if (!node || typeof node !== "object") return acc;

  // direct node
  if (
    (node?.id || node?.["@id"]) &&
    node?.odds &&
    typeof node.odds === "object"
  ) {
    acc.push(node);
  }

  // traverse
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) {
      for (const item of v) collectOddsNodes(item, acc);
    } else if (v && typeof v === "object") {
      collectOddsNodes(v, acc);
    }
  }

  return acc;
}

/**
 * Extract best Home/Away from one odds node.
 * We prefer bet365 if present, else first bookmaker that has Home/Away.
 */
function extractMainHomeAway(oddsNode) {
  const types = toArr(oddsNode?.odds?.type);

  // GoalServe sometimes uses { bookmaker: [...] } directly inside type, or nested.
  const allBookmakers = [];
  for (const t of types) {
    const bms = toArr(t?.bookmaker);
    for (const bm of bms) allBookmakers.push(bm);
  }

  const pickFromBookmaker = (bm) => {
    const oddsArr = toArr(bm?.odd);
    const home = oddsArr.find((o) => (o?.name || o?.["@name"]) === "Home");
    const away = oddsArr.find((o) => (o?.name || o?.["@name"]) === "Away");
    const h = Number(home?.value ?? home?.["@value"]);
    const a = Number(away?.value ?? away?.["@value"]);
    if (Number.isFinite(h) && h > 1 && Number.isFinite(a) && a > 1) {
      return { home: h, away: a, bookmaker: bm?.name || bm?.["@name"] || "" };
    }
    return null;
  };

  // prefer bet365
  const bet365 = allBookmakers.find((bm) => {
    const n = (bm?.name || bm?.["@name"] || "").toLowerCase();
    return n.includes("bet365");
  });
  if (bet365) {
    const p = pickFromBookmaker(bet365);
    if (p) return p;
  }

  // else first valid
  for (const bm of allBookmakers) {
    const p = pickFromBookmaker(bm);
    if (p) return p;
  }

  return null;
}

/** normalize GoalServe getodds JSON -> map matchId -> {home, away, bookmaker} */
function normalizeGoalServeOdds(json) {
  const nodes = collectOddsNodes(json, []);
  const out = new Map();

  for (const n of nodes) {
    const id = String(n?.id ?? n?.["@id"] ?? "").trim();
    if (!id) continue;

    const main = extractMainHomeAway(n);
    if (!main) continue;

    // Keep first found, unless we later find bet365 (we already prefer bet365 at extract)
    if (!out.has(id)) out.set(id, main);
  }

  return out;
}

/**
 * tennis_scores/home?json=1
 * Uses GOALSERVE_TOKEN (recommended) or GOALSERVE_KEY legacy.
 */
export async function fetchLiveTennisRaw() {
  const token = (process.env.GOALSERVE_TOKEN || "").trim();
  const key = (process.env.GOALSERVE_KEY || "").trim();

  const candidates = [];

  if (token) {
    candidates.push(`http://feed1.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
    candidates.push(`http://feed2.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
    candidates.push(`http://www.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
  }

  if (!token && key) {
    candidates.push(`https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${encodeURIComponent(key)}`);
    candidates.push(`https://www.goalserve.com/getfeed/tennis_scores/home/?key=${encodeURIComponent(key)}`);
  }

  if (candidates.length === 0) {
    const err = new Error("missing_goalserve_credentials");
    err.meta = { need: "Set GOALSERVE_TOKEN (recommended) or GOALSERVE_KEY in Vercel env." };
    throw err;
  }

  const tried = [];
  let lastErr = null;

  for (const url of candidates) {
    tried.push(url);

    try {
      const { ok, status, text } = await fetchText(url);

      if (!ok) {
        const looksXML = text?.trim().startsWith("<");
        const e = new Error(`upstream_${status}${looksXML ? "_xml" : ""}`);
        e.payload = text?.slice(0, 600);
        lastErr = e;
        await sleep(250);
        continue;
      }

      if (text?.trim().startsWith("<")) {
        const e = new Error("upstream_xml_received");
        e.payload = text?.slice(0, 600);
        lastErr = e;
        await sleep(200);
        continue;
      }

      const parsed = safeJsonParse(text);
      if (!parsed.ok) {
        const e = new Error("upstream_json_parse_failed");
        e.payload = text?.slice(0, 600);
        lastErr = e;
        await sleep(200);
        continue;
      }

      return { json: parsed.json, urlOk: url, urlTried: tried };
    } catch (e) {
      lastErr = e;
      await sleep(200);
      continue;
    }
  }

  const err = new Error("all_goalserve_hosts_failed");
  err.cause = lastErr;
  err.urlTried = tried;
  throw err;
}

export async function fetchLiveTennis() {
  const { json, urlOk, urlTried } = await fetchLiveTennisRaw();
  const matches = normalizeGoalServeScores(json);
  return { matches, meta: { urlOk, urlTried, count: matches.length } };
}

/**
 * getodds/soccer?cat=tennis_10&json=1
 * NOTE: GoalServe uses "soccer" in the path for odds feed (historical quirk).
 */
export async function fetchTennisOddsRaw() {
  const token = (process.env.GOALSERVE_TOKEN || "").trim();
  const key = (process.env.GOALSERVE_KEY || "").trim();

  const candidates = [];

  if (token) {
    candidates.push(`https://feed1.goalserve.com/getfeed/${token}/getodds/soccer?cat=tennis_10&json=1`);
    candidates.push(`https://feed2.goalserve.com/getfeed/${token}/getodds/soccer?cat=tennis_10&json=1`);
    candidates.push(`https://www.goalserve.com/getfeed/${token}/getodds/soccer?cat=tennis_10&json=1`);
  }

  if (!token && key) {
    // legacy query-key mode (if you ever used it for odds)
    candidates.push(`https://www.goalserve.com/getfeed/getodds/soccer?cat=tennis_10&json=1&key=${encodeURIComponent(key)}`);
  }

  if (candidates.length === 0) {
    const err = new Error("missing_goalserve_credentials");
    err.meta = { need: "Set GOALSERVE_TOKEN (recommended) or GOALSERVE_KEY in Vercel env." };
    throw err;
  }

  const tried = [];
  let lastErr = null;

  for (const url of candidates) {
    tried.push(url);

    try {
      const { ok, status, text } = await fetchText(url);

      if (!ok) {
        const looksXML = text?.trim().startsWith("<");
        const e = new Error(`odds_upstream_${status}${looksXML ? "_xml" : ""}`);
        e.payload = text?.slice(0, 600);
        lastErr = e;
        await sleep(250);
        continue;
      }

      if (text?.trim().startsWith("<")) {
        const e = new Error("odds_upstream_xml_received");
        e.payload = text?.slice(0, 600);
        lastErr = e;
        await sleep(200);
        continue;
      }

      const parsed = safeJsonParse(text);
      if (!parsed.ok) {
        const e = new Error("odds_upstream_json_parse_failed");
        e.payload = text?.slice(0, 600);
        lastErr = e;
        await sleep(200);
        continue;
      }

      return { json: parsed.json, urlOk: url, urlTried: tried };
    } catch (e) {
      lastErr = e;
      await sleep(200);
      continue;
    }
  }

  const err = new Error("all_goalserve_odds_hosts_failed");
  err.cause = lastErr;
  err.urlTried = tried;
  throw err;
}

export async function fetchTennisOdds() {
  const { json, urlOk, urlTried } = await fetchTennisOddsRaw();
  const oddsMap = normalizeGoalServeOdds(json);
  return { oddsMap, meta: { urlOk, urlTried, count: oddsMap.size } };
}

/**
 * ✅ FIX FUNCTION: fetchPredictions()
 * This is what your /api/gs/tennis-predictions endpoint is calling.
 * We return merged matches with odds (if available).
 *
 * IMPORTANT:
 * - We do NOT run AI here (to avoid coupling & crashes).
 * - Your endpoint can run analyzeMatch separately if it wants.
 */
export async function fetchPredictions() {
  const live = await fetchLiveTennis();
  const odds = await fetchTennisOdds().catch((e) => ({
    oddsMap: new Map(),
    meta: { error: e?.message || "odds_failed", count: 0 },
  }));

  const merged = live.matches.map((m) => {
    const o = odds.oddsMap.get(String(m.id)) || null;
    return {
      ...m,
      odds: o
        ? { home: o.home, away: o.away, bookmaker: o.bookmaker }
        : null,
    };
  });

  return {
    matches: merged,
    meta: {
      liveCount: live?.meta?.count ?? 0,
      oddsCount: odds?.meta?.count ?? 0,
      liveUrlOk: live?.meta?.urlOk || null,
      oddsUrlOk: odds?.meta?.urlOk || null,
    },
  };
}