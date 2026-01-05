// api/gs/tennis-odds.js
// LIVEBET IQ — LOCKDOWN+ Stability Patch (gzip/deflate aware)
// Purpose: Stabilize GoalServe tennis odds endpoint with:
//  - gzip/deflate decode (GoalServe often serves compressed content)
//  - cache + retry + stale fallback (never hard-fail to frontend)
//
// Constraints: Server-side only. No UI changes.

import zlib from "zlib";

const CACHE = {
  ts: 0,
  data: null,
  urlOk: null,
  urlTried: [],
};

const TTL_MS = 55 * 1000; // throttle upstream
const HARD_TIMEOUT_MS = 9000;
const RETRIES = 2;

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

function looksGzipped(buf) {
  // gzip magic bytes: 1F 8B
  return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function looksDeflated(buf) {
  // zlib/deflate streams often start with 0x78 0x9C / 0x78 0x01 / 0x78 0xDA
  return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x78 && (buf[1] === 0x01 || buf[1] === 0x9c || buf[1] === 0xda);
}

function decodeBufferToText(buf) {
  // Try UTF-8 first (most common)
  let text = buf.toString("utf8");
  if (safeJsonParse(text)) return text;

  // Some GoalServe endpoints return ISO-8859-1-ish; try latin1 fallback
  const latin1 = buf.toString("latin1");
  if (safeJsonParse(latin1)) return latin1;

  // Last resort: return utf8 (even if not JSON), for debug preview
  return text;
}

async function fetchWithTimeout(url, timeoutMs = HARD_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        // Critical: ask for gzip/deflate (GoalServe often responds compressed)
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": "livebetiq3/tennis-odds-stabilizer",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);

    const enc = String(res.headers.get("content-encoding") || "").toLowerCase();

    let out = buf;
    try {
      if (enc.includes("gzip") || looksGzipped(buf)) {
        out = zlib.gunzipSync(buf);
      } else if (enc.includes("deflate") || looksDeflated(buf)) {
        out = zlib.inflateSync(buf);
      } else {
        // Sometimes servers omit headers but still compress; attempt safe gunzip if magic matches
        if (looksGzipped(buf)) out = zlib.gunzipSync(buf);
        else if (looksDeflated(buf)) out = zlib.inflateSync(buf);
      }
    } catch {
      // If decompression fails, keep raw buffer (we'll still try to decode it)
      out = buf;
    }

    const text = decodeBufferToText(out);

    return {
      ok: res.ok,
      status: res.status,
      text,
      headers: Object.fromEntries(res.headers.entries()),
      contentEncoding: enc,
      rawBytes: buf.length,
      outBytes: out.length,
    };
  } finally {
    clearTimeout(t);
  }
}

function buildOddsUrls() {
  const token = String(process.env.GOALSERVE_TOKEN || process.env.GS_TOKEN || "").trim();
  const key = String(process.env.GOALSERVE_KEY || "").trim();
  const cred = token || key;
  if (!cred) return [];

  const cat = "tennis_10";
  const encCred = encodeURIComponent(cred);

  // Must be HTTPS (avoid redirects / mixed content)
  return [
    `https://www.goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
    `https://goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
    `https://feed1.goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
    `https://feed2.goalserve.com/getfeed/${encCred}/getodds/soccer?cat=${cat}&json=1`,
  ];
}

async function fetchOddsUpstream() {
  const urls = buildOddsUrls();
  if (!urls.length) {
    const err = new Error("missing_goalserve_credentials");
    err.meta = { need: "Set GOALSERVE_TOKEN (or GS_TOKEN) / GOALSERVE_KEY on Vercel." };
    throw err;
  }

  const tried = [];
  let lastErr = null;

  for (const url of urls) {
    tried.push(url);

    try {
      const r = await fetchWithTimeout(url);

      const trimmed = String(r.text || "").trim();
      const first = trimmed.slice(0, 180);

      if (!r.ok) {
        const e = new Error(`upstream_http_${r.status}`);
        e.payload = first;
        e.meta = { url, contentEncoding: r.contentEncoding };
        lastErr = e;
        await sleep(180);
        continue;
      }

      const json = safeJsonParse(trimmed);
      if (!json || typeof json !== "object") {
        const e = new Error("upstream_non_json");
        e.payload = first;
        e.meta = { url, contentEncoding: r.contentEncoding, rawBytes: r.rawBytes, outBytes: r.outBytes };
        lastErr = e;
        await sleep(180);
        continue;
      }

      return { json, urlOk: url, urlTried: tried, meta: { contentEncoding: r.contentEncoding, rawBytes: r.rawBytes, outBytes: r.outBytes } };
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
    return res.status(200).json({
      ...CACHE.data,
      cached: true,
      stale: false,
      cacheAgeMs: now - CACHE.ts,
      build: "v10.2.0-odds-gzip-cache-retry",
      ...(debug ? { debug: { urlOk: CACHE.urlOk, urlTried: CACHE.urlTried, ttlMs: TTL_MS } } : {}),
    });
  }

  // 2) Attempt upstream fetch with limited retries
  let lastError = null;

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const { json, urlOk, urlTried, meta } = await fetchOddsUpstream();

      const payload = {
        ok: true,
        source: "goalserve-tennis-odds",
        cached: false,
        stale: false,
        url: urlOk,
        raw: json,
        fetchedAtMs: now,
      };

      CACHE.ts = now;
      CACHE.data = payload;
      CACHE.urlOk = urlOk;
      CACHE.urlTried = urlTried;

      return res.status(200).json({
        ...payload,
        build: "v10.2.0-odds-gzip-cache-retry",
        ...(debug ? { debug: { attempt, urlOk, urlTried, ttlMs: TTL_MS, meta } } : {}),
      });
    } catch (e) {
      lastError = e;
      await sleep(220);
    }
  }

  // 3) Fail-soft: serve stale cache if exists
  if (CACHE.data) {
    return res.status(200).json({
      ...CACHE.data,
      ok: true,
      source: "stale-cache",
      cached: true,
      stale: true,
      cacheAgeMs: now - CACHE.ts,
      build: "v10.2.0-odds-gzip-cache-retry",
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
  }

  // 4) No cache available yet: still return safe JSON 200
  return res.status(200).json({
    ok: false,
    source: "none",
    cached: false,
    stale: false,
    raw: null,
    build: "v10.2.0-odds-gzip-cache-retry",
    error: String(lastError?.message || "odds_upstream_failed"),
    ...(debug ? { debug: { urlTried: lastError?.urlTried || [], cause: String(lastError?.cause?.message || "") } } : {}),
  });
}