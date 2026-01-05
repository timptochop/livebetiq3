// api/gs/tennis-odds.js
// Stability Freeze patch: throttle + cache + retry + safe JSON (never breaks UI)
// Upstream: /getodds/soccer?cat=tennis_10  (GoalServe tennis odds category)

const CACHE = {
  ts: 0,
  data: null, // { ok:true, raw:{...}, meta:{...} }
  urlOk: null,
  urlTried: [],
};

const TTL_MS = 55 * 1000; // fetch upstream at most once per ~55s
const HARD_TIMEOUT_MS = 9000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, timeoutMs = HARD_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "livebetiq3/tennis-odds",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    return { ok: res.ok, status: res.status, text, headers: Object.fromEntries(res.headers.entries()) };
  } finally {
    clearTimeout(t);
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildOddsUrls() {
  const token = String(process.env.GOALSERVE_TOKEN || "").trim(); // recommended
  const key = String(process.env.GOALSERVE_KEY || "").trim(); // legacy
  const cat = "tennis_10";

  const urls = [];

  // Preferred: token/key in path style
  const cred = token || key;

  if (cred) {
    // Canonical host first
    urls.push(`https://goalserve.com/getfeed/${encodeURIComponent(cred)}/getodds/soccer?cat=${cat}`);
    // Common alternate host
    urls.push(`https://www.goalserve.com/getfeed/${encodeURIComponent(cred)}/getodds/soccer?cat=${cat}`);
    // Legacy mirrors (sometimes region-blocked; keep as fallback)
    urls.push(`http://feed1.goalserve.com/getfeed/${encodeURIComponent(cred)}/getodds/soccer?cat=${cat}`);
    urls.push(`http://feed2.goalserve.com/getfeed/${encodeURIComponent(cred)}/getodds/soccer?cat=${cat}`);
  }

  return urls;
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

      // If upstream is non-200, continue to next host
      if (!ok) {
        const e = new Error(`upstream_http_${status}`);
        e.payload = trimmed.slice(0, 400);
        lastErr = e;
        await sleep(180);
        continue;
      }

      // Must be JSON
      const json = safeJson(trimmed);
      if (!json || typeof json !== "object") {
        const e = new Error("upstream_non_json");
        e.payload = trimmed.slice(0, 400);
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

  // 1) Serve fresh cache if within TTL
  if (CACHE.data && now - CACHE.ts < TTL_MS) {
    res.status(200).json({
      ...CACHE.data,
      cached: true,
      cacheAgeMs: now - CACHE.ts,
      build: "v10.1.9-odds-stable-cache-retry",
      ...(debug
        ? { debug: { urlOk: CACHE.urlOk, urlTried: CACHE.urlTried, ttlMs: TTL_MS } }
        : {}),
    });
    return;
  }

  // 2) Fetch upstream with limited retries
  const attempts = 2; // conservative: Stability Freeze
  let lastError = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const { json, urlOk, urlTried } = await fetchOddsUpstream();

      // We keep "raw" exactly as upstream gives it (frontend expects json.raw sometimes,
      // but your fetchTennisOdds returns json.raw; here we provide it in raw for consistency)
      const payload = {
        ok: true,
        source: "goalserve-tennis-odds",
        cached: false,
        url: urlOk,
        raw: json,
        fetchedAtMs: now,
      };

      CACHE.ts = now;
      CACHE.data = payload;
      CACHE.urlOk = urlOk;
      CACHE.urlTried = urlTried;

      res.status(200).json({
        ...payload,
        build: "v10.1.9-odds-stable-cache-retry",
        ...(debug ? { debug: { urlOk, urlTried, attempt: i + 1, ttlMs: TTL_MS } } : {}),
      });
      return;
    } catch (e) {
      lastError = e;
      await sleep(220);
    }
  }

  // 3) Fail-soft: if we have stale cache, serve it (prevents UI from “randomly losing odds”)
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
              ttlMs: TTL_MS,
            },
          }
        : {}),
    });
    return;
  }

  // 4) No cache available: still return 200 safe JSON (frontend must not crash)
  res.status(200).json({
    ok: false,
    source: "none",
    cached: false,
    raw: null,
    build: "v10.1.9-odds-stable-cache-retry",
    error: String(lastError?.message || "odds_upstream_failed"),
    ...(debug
      ? {
          debug: {
            urlTried: lastError?.urlTried || [],
            cause: String(lastError?.cause?.message || ""),
          },
        }
      : {}),
  });
}