// api/gs/tennis-odds.js
// LIVEBET IQ — LOCKDOWN+ Stability Patch
// Purpose: Stabilize GoalServe tennis odds endpoint with cache + retry + stale fallback.
// Constraints: Server-side only. No UI changes. Never hard-fail (always returns safe JSON 200).
//
// Expected upstream (historical): /getfeed/<KEY>/getodds/soccer?cat=tennis_10
// Env: GOALSERVE_TOKEN (preferred) or GOALSERVE_KEY (legacy)

const CACHE = {
  ts: 0,
  data: null, // { ok, source, url, raw, fetchedAtMs, ... }
  urlOk: null,
  urlTried: [],
};

const TTL_MS = 55 * 1000; // throttle upstream to at most 1 fetch per ~55s
const HARD_TIMEOUT_MS = 9000;
const RETRIES = 2; // conservative for stability freeze

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs = HARD_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "livebetiq3/tennis-odds-stabilizer",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text,
      headers: Object.fromEntries(res.headers.entries()),
    };
  } finally {
    clearTimeout(t);
  }
}

function buildOddsUrls() {
  const token = String(process.env.GOALSERVE_TOKEN || "").trim();
  const key = String(process.env.GOALSERVE_KEY || "").trim();
  const cred = token || key;
  if (!cred) return [];

  const cat = "tennis_10";
  const encCred = encodeURIComponent(cred);

  // Order matters: start with canonical host
  return [
    `https://www.goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
    `https://goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
    // Mirrors (sometimes behave differently / sometimes blocked)
    `https://feed1.goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
    `https://feed2.goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
  ];
}

async function fetchOddsUpstream() {
  const urls = buildOddsUrls();
  if (!urls.length) {
    const err = new Error("missing_goalserve_credentials");
    err.meta = { need: "Set GOALSERVE_TOKEN (preferred) or GOALSERVE_KEY in Vercel env." };
    throw err;
  }

  const tried = [];
  let lastErr = null;

  for (const url of urls) {
    tried.push(url);
    try {
      const { ok, status, text } = await fetchWithTimeout(url);
      const trimmed = String(text || "").trim();

      if (!ok) {
        const e = new Error(`upstream_http_${status}`);
        e.payload = trimmed.slice(0, 500);
        lastErr = e;
        await sleep(180);
        continue;
      }

      const json = safeJsonParse(trimmed);
      if (!json || typeof json !== "object") {
        const e = new Error("upstream_non_json");
        e.payload = trimmed.slice(0, 500);
        lastErr = e;
        await sleep(180);
        continue;
      }

      return { json, urlOk: url, urlTried: tried };
    } catch (e) {
      lastErr = e;
      await sleep(180);
      continue;
    }
  }

  const err = new Error("all_odds_hosts_failed");
  err.cause = lastErr;
  err.urlTried = tried;
  throw err;
}

export default async function handler(req, res) {
  const now = Date.now();
  const debug = String(req.query?.debug || "") === "1";

  res.setHeader("Cache-Control", "no-store");

  // 1) Serve fresh cache inside TTL
  if (CACHE.data && now - CACHE.ts < TTL_MS) {
    res.status(200).json({
      ...CACHE.data,
      cached: true,
      stale: false,
      cacheAgeMs: now - CACHE.ts,
      build: "v10.1.9-odds-stable-cache-retry",
      ...(debug ? { debug: { urlOk: CACHE.urlOk, urlTried: CACHE.urlTried, ttlMs: TTL_MS } } : {}),
    });
    return;
  }

  // 2) Attempt upstream fetch with limited retries
  let lastError = null;

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const { json, urlOk, urlTried } = await fetchOddsUpstream();

      const payload = {
        ok: true,
        source: "goalserve-tennis-odds",
        cached: false,
        stale: false,
        url: urlOk,
        raw: json, // keep raw payload intact for downstream parsing
        fetchedAtMs: now,
      };

      CACHE.ts = now;
      CACHE.data = payload;
      CACHE.urlOk = urlOk;
      CACHE.urlTried = urlTried;

      res.status(200).json({
        ...payload,
        build: "v10.1.9-odds-stable-cache-retry",
        ...(debug ? { debug: { attempt, urlOk, urlTried, ttlMs: TTL_MS } } : {}),
      });
      return;
    } catch (e) {
      lastError = e;
      await sleep(220);
    }
  }

  // 3) Fail-soft: serve stale cache if exists (prevents “randomly losing odds”)
  if (CACHE.data) {
    res.status(200).json({
      ...CACHE.data,
      ok: true,
      source: "stale-cache",
      cached: true,
      stale: true,
      cacheAgeMs: now - CACHE.ts,
      build: "v10.1.9-odds-stable-cache-retry",
      error: String(lastError?.message || "odds_upstream_failed"),
      ...(debug
        ? {
            debug: {
              urlOk: CACHE.urlOk,
              urlTried: CACHE.urlTried,
              lastError: String(lastError?.message || ""),
              cause: String(lastError?.cause?.message || ""),
              ttlMs: TTL_MS,
            },
          }
        : {}),
    });
    return;
  }

  // 4) No cache available yet: still return safe JSON 200
  res.status(200).json({
    ok: false,
    source: "none",
    cached: false,
    stale: false,
    raw: null,
    build: "v10.1.9-odds-stable-cache-retry",
    error: String(lastError?.message || "odds_upstream_failed"),
    ...(debug
      ? { debug: { urlTried: lastError?.urlTried || [], cause: String(lastError?.cause?.message || "") } }
      : {}),
  });
}