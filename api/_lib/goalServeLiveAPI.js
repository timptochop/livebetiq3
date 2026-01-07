// api/_lib/goalServeLiveAPI.js
// Robust GoalServe fetcher with multiple fallbacks + strict JSON guard

const READ_TIMEOUT_MS = 12000;

/** tiny helper */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** fetch with timeout + plain text body (we parse ourselves) */
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
    return { ok: res.ok, status: res.status, text, headers: Object.fromEntries(res.headers.entries()) };
  } finally {
    clearTimeout(to);
  }
}

/** normalize GoalServe JSON -> flat matches[] */
function normalizeGoalServeJSON(json) {
  const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
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
        s1: p?.["@s1"] ?? p?.s1 ?? null,
        s2: p?.["@s2"] ?? p?.s2 ?? null,
        s3: p?.["@s3"] ?? p?.s3 ?? null,
        s4: p?.["@s4"] ?? p?.s4 ?? null,
        s5: p?.["@s5"] ?? p?.s5 ?? null,
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
 * Try multiple GoalServe endpoints in order.
 * Priority is IMPORTANT:
 * 1) goalserve.com token-in-path (works in browser + is the canonical host)
 * 2) goalserve.com "home" variant
 * 3) feed1/feed2 (legacy mirrors; may return empty/blocked depending on region)
 * 4) old query key fallback (only if no token)
 */
export async function fetchLiveTennisRaw() {
  const token = (process.env.GOALSERVE_TOKEN || "").trim();
  const key = (process.env.GOALSERVE_KEY || "").trim();

  const candidates = [];

  if (token) {
    candidates.push(`https://goalserve.com/getfeed/${token}/tennis_scores/d1?json=1`);
    candidates.push(`https://goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);

    candidates.push(`https://www.goalserve.com/getfeed/${token}/tennis_scores/d1?json=1`);
    candidates.push(`https://www.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);

    candidates.push(`http://feed1.goalserve.com/getfeed/${token}/tennis_scores/d1?json=1`);
    candidates.push(`http://feed1.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
    candidates.push(`http://feed2.goalserve.com/getfeed/${token}/tennis_scores/d1?json=1`);
    candidates.push(`http://feed2.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
  }

  if (!token && key) {
    candidates.push(`https://goalserve.com/getfeed/tennis_scores/d1/?json=1&key=${encodeURIComponent(key)}`);
    candidates.push(`https://goalserve.com/getfeed/tennis_scores/home/?json=1&key=${encodeURIComponent(key)}`);
    candidates.push(`https://www.goalserve.com/getfeed/tennis_scores/d1/?json=1&key=${encodeURIComponent(key)}`);
    candidates.push(`https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${encodeURIComponent(key)}`);
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

      const trimmed = (text || "").trim();
      const looksXML = trimmed.startsWith("<");
      const looksHTML = /^<!doctype html|^<html/i.test(trimmed);

      if (!ok) {
        const e = new Error(`upstream_${status}${looksXML ? "_xml" : looksHTML ? "_html" : ""}`);
        e.payload = trimmed.slice(0, 500);
        lastErr = e;
        await sleep(250);
        continue;
      }

      if (looksXML || looksHTML) {
        const e = new Error(looksXML ? "upstream_xml_received" : "upstream_html_received");
        e.payload = trimmed.slice(0, 500);
        lastErr = e;
        await sleep(200);
        continue;
      }

      const json = JSON.parse(trimmed);

      return { json, urlOk: url, urlTried: tried };
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
  const matches = normalizeGoalServeJSON(json);

  return {
    matches,
    meta: { urlOk, urlTried, count: matches.length },
  };
}

/**
 * NEW: Predictions provider for /api/gs/tennis-predictions
 * Minimal-safe implementation:
 * - Pull live matches (normalized)
 * - Pull odds payload from our own endpoint (/api/gs/tennis-odds)
 * - Return both, plus basic mapping hints (no UI changes)
 */
export async function fetchPredictions() {
  const base =
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    process.env.PUBLIC_BASE_URL ||
    "https://livebetiq3.vercel.app";

  const [live, odds] = await Promise.all([
    fetchLiveTennis(),
    fetch(`${base}/api/gs/tennis-odds?debug=0`, { cache: "no-store" }).then((r) => r.json()),
  ]);

  const matches = Array.isArray(live?.matches) ? live.matches : [];
  const oddsRaw = odds?.raw || null;

  // We do not enforce matching here (LOCKDOWN+ safe); downstream can map by team/player names.
  return {
    ok: true,
    matches,
    oddsOk: Boolean(odds?.ok),
    oddsSource: odds?.source || "unknown",
    oddsRaw,
    meta: {
      matchesCount: matches.length,
      oddsHasRaw: Boolean(oddsRaw),
      liveMeta: live?.meta || {},
    },
  };
}