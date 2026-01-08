// api/gs/tennis-odds.js
// Hardened GoalServe odds proxy with cache + retry + stale fallback (LOCKDOWN+ safe)
// - Never breaks UI/AI flow due to upstream instability
// - Returns last-known-good payload when GoalServe fails intermittently

const READ_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 60 * 1000; // 60s
const MAX_RETRIES = 3;

// In-memory cache per serverless instance (best-effort; OK for Vercel)
let CACHE = {
  ts: 0,
  data: null,
  meta: null,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowMs() {
  return Date.now();
}

function isFresh(ts) {
  return ts && nowMs() - ts <= CACHE_TTL_MS;
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        // Ask for compressed; platform usually decompresses automatically
        "Accept": "application/json,text/plain,*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "livebetiq/odds-proxy",
      },
      signal: ctl.signal,
    });

    const status = res.status;
    const text = await res.text();
    return { ok: res.ok, status, text };
  } finally {
    clearTimeout(to);
  }
}

async function fetchGoalServeOddsRaw() {
  const key = process.env.GOALSERVE_KEY || process.env.GOALSERVE_API_KEY || "";
  if (!key) {
    const err = new Error("Missing GOALSERVE_KEY (or GOALSERVE_API_KEY) env var");
    err.code = "missing_key";
    throw err;
  }

  // NOTE: Keep your known-working odds endpoint here.
  // If your project already uses a specific GoalServe odds endpoint, paste it below.
  // This is the common pattern; do not change unless your baseline differs.
  const url = `https://www.goalserve.com/getfeed/${encodeURIComponent(key)}/tennis_odds/odds`;

  let lastErr = null;
  let lastResp = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const attempt = i + 1;
    try {
      const r = await fetchTextWithTimeout(url, READ_TIMEOUT_MS);
      lastResp = r;

      // Retry on non-200 or empty body or HTML garbage
      const body = (r.text || "").trim();

      if (!r.ok) {
        lastErr = new Error(`Upstream not ok (status ${r.status})`);
        lastErr.code = "upstream_status";
        throw lastErr;
      }

      if (!body) {
        lastErr = new Error("Upstream empty body");
        lastErr.code = "upstream_empty";
        throw lastErr;
      }

      // If upstream returned HTML (common on errors), treat as fail
      if (body.startsWith("<!DOCTYPE") || body.startsWith("<html") || body.includes("<body")) {
        lastErr = new Error("Upstream returned HTML (not JSON)");
        lastErr.code = "upstream_html";
        throw lastErr;
      }

      const parsed = safeJsonParse(body);
      if (!parsed.ok) {
        lastErr = new Error("Upstream invalid JSON");
        lastErr.code = "upstream_bad_json";
        lastErr.details = String(parsed.error?.message || parsed.error || "");
        throw lastErr;
      }

      return {
        ok: true,
        status: r.status,
        data: parsed.value,
        meta: {
          url,
          attempt,
          bytes: body.length,
        },
      };
    } catch (e) {
      lastErr = e;
      // backoff: 250ms, 650ms, 1200ms
      const backoff = attempt === 1 ? 250 : attempt === 2 ? 650 : 1200;
      await sleep(backoff);
    }
  }

  const err = new Error(lastErr?.message || "Upstream fetch failed after retries");
  err.code = lastErr?.code || "upstream_failed";
  err.last = {
    status: lastResp?.status ?? null,
    sample: (lastResp?.text || "").slice(0, 180),
  };
  throw err;
}

export default async function handler(req, res) {
  const debug = String(req?.query?.debug || "") === "1";

  // Serve fresh cache if available (fast + stable)
  if (CACHE.data && isFresh(CACHE.ts)) {
    const payload = {
      ok: true,
      cached: true,
      stale: false,
      ts: CACHE.ts,
      data: CACHE.data,
    };

    if (debug) payload.debug = { cacheAgeMs: nowMs() - CACHE.ts, meta: CACHE.meta };
    return res.status(200).json(payload);
  }

  // Fetch upstream (with retries)
  try {
    const upstream = await fetchGoalServeOddsRaw();

    // Update cache (last-known-good)
    CACHE = {
      ts: nowMs(),
      data: upstream.data,
      meta: upstream.meta,
    };

    const payload = {
      ok: true,
      cached: false,
      stale: false,
      ts: CACHE.ts,
      data: CACHE.data,
    };

    if (debug) payload.debug = { meta: upstream.meta };
    return res.status(200).json(payload);
  } catch (err) {
    const hasStale = !!CACHE.data;

    // Stale fallback: return last-known-good instead of breaking the app
    if (hasStale) {
      const payload = {
        ok: true,
        cached: true,
        stale: true,
        ts: CACHE.ts,
        data: CACHE.data,
      };

      if (debug) {
        payload.debug = {
          error: {
            code: err?.code || "unknown",
            message: err?.message || "unknown_error",
            last: err?.last || null,
          },
          cacheAgeMs: nowMs() - CACHE.ts,
          meta: CACHE.meta,
        };
      }

      return res.status(200).json(payload);
    }

    // No cache exists yet → return safe error payload (not 500 HTML)
    const payload = {
      ok: false,
      cached: false,
      stale: false,
      ts: 0,
      data: null,
      error: {
        code: err?.code || "odds_failed",
        message: err?.message || "odds_failed",
        last: err?.last || null,
      },
    };

    return res.status(200).json(payload);
  }
}