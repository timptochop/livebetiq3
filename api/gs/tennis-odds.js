const zlib = require("zlib");

const TOKEN = process.env.GOALSERVE_TOKEN || "";

// ─────────────────────────────────────────────
// Simple in-memory cache (per Vercel instance)
// ─────────────────────────────────────────────
let LAST_RESPONSE = null;
let LAST_FETCH_TS = 0;
// 45 seconds backend refresh window
const CACHE_TTL_MS = 45 * 1000;

/**
 * Safely gunzip if needed.
 * @param {Buffer} buf
 * @returns {string}
 */
function maybeGunzipToString(buf) {
  if (!buf || !buf.length) return "";
  // GZIP magic bytes: 0x1f 0x8b
  const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
  if (!isGzip) {
    return buf.toString("utf8");
  }

  try {
    const out = zlib.gunzipSync(buf);
    return out.toString("utf8");
  } catch (err) {
    // fallback: at least return latin1 so we see something
    return buf.toString("latin1");
  }
}

/**
 * Build upstream URL for tennis odds feed.
 */
function buildOddsUrl() {
  if (!TOKEN) return null;
  // From feed_urls: getodds/soccer?cat=tennis_10&json=1
  return `https://www.goalserve.com/getfeed/${TOKEN}/getodds/soccer?cat=tennis_10&json=1`;
}

/**
 * Vercel Serverless handler
 */
module.exports = async function handler(req, res) {
  try {
    // 1) Healthcheck mode (no cache, πάντα fresh info)
    const health = req.query && req.query.health;
    if (health) {
      return res.status(200).json({
        ok: true,
        message: "tennis-odds healthcheck",
        hasToken: Boolean(TOKEN),
        envKeys: ["GOALSERVE_TOKEN"],
      });
    }

    // 2) Serve from cache if still “fresh”
    const now = Date.now();
    if (LAST_RESPONSE && now - LAST_FETCH_TS < CACHE_TTL_MS) {
      return res.status(200).json({
        ...LAST_RESPONSE,
        cached: true,
      });
    }

    // 3) Basic env validation
    const url = buildOddsUrl();
    if (!url) {
      return res.status(500).json({
        ok: false,
        error: "missing-goalserve-token",
      });
    }

    // 4) Fetch from GoalServe
    let upstream;
    try {
      upstream = await fetch(url, {
        method: "GET",
        headers: {
          // let node/fetch decide Accept-Encoding
        },
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: "fetch-failed",
        detail: String(err),
        url,
      });
    }

    // 5) Read body as Buffer and maybe gunzip
    let buf;
    try {
      const ab = await upstream.arrayBuffer();
      buf = Buffer.from(ab);
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: "body-read-failed",
        detail: String(err),
        status: upstream.status,
        url,
      });
    }

    const text = maybeGunzipToString(buf);

    // If HTTP status is NOT 2xx, return diagnostic JSON (do NOT cache)
    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: "upstream-not-ok",
        status: upstream.status,
        url,
        bodySnippet: text.slice(0, 400),
      });
    }

    // 6) Try JSON parse (because we added &json=1)
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "json-parse-failed",
        status: upstream.status,
        url,
        bodySnippet: text.slice(0, 400),
        detail: String(err),
      });
    }

    // 7) Build normalized response + store in cache
    const payload = {
      ok: true,
      source: "goalserve-tennis-odds",
      url,
      raw: json,
    };

    LAST_RESPONSE = payload;
    LAST_FETCH_TS = Date.now();

    return res.status(200).json({
      ...payload,
      cached: false,
    });
  } catch (err) {
    // Safety net – avoid generic Vercel "Function crashed" page
    return res.status(500).json({
      ok: false,
      error: "handler-crashed",
      detail: String(err),
    });
  }
};