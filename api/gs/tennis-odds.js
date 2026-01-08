// api/gs/tennis-odds.js
// FINAL – GoalServe Tennis Odds (XML) → JSON
// LOCKDOWN+ | Production safe | Cache + Retry + Stale fallback

import { parseStringPromise } from "xml2js";

const READ_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 60 * 1000; // 60s
const MAX_RETRIES = 3;

let CACHE = {
  ts: 0,
  data: null,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function now() {
  return Date.now();
}

function isFresh(ts) {
  return ts && now() - ts < CACHE_TTL_MS;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "livebetiq/odds",
        Accept: "*/*",
      },
      signal: controller.signal,
    });

    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(id);
  }
}

function buildGoalServeOddsUrl() {
  const key =
    process.env.GOALSERVE_KEY ||
    process.env.GOALSERVE_API_KEY ||
    "";

  if (!key) {
    throw new Error("Missing GOALSERVE_KEY");
  }

  // OFFICIAL GoalServe Tennis Odds (XML)
  return `https://www.goalserve.com/getfeed/${key}/getodds/soccer?cat=tennis_10`;
}

async function fetchOddsXML() {
  const url = buildGoalServeOddsUrl();
  let lastErr = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetchWithTimeout(url);

      if (!res.ok || !res.text.trim()) {
        throw new Error("Upstream empty or non-200");
      }

      if (res.text.startsWith("<")) {
        const parsed = await parseStringPromise(res.text, {
          explicitArray: false,
          mergeAttrs: true,
        });
        return parsed;
      }

      throw new Error("Unexpected non-XML response");
    } catch (e) {
      lastErr = e;
      await sleep(300 + i * 400);
    }
  }

  throw lastErr;
}

export default async function handler(req, res) {
  const debug = req.query.debug === "1";

  // Serve fresh cache
  if (CACHE.data && isFresh(CACHE.ts)) {
    return res.status(200).json({
      ok: true,
      cached: true,
      stale: false,
      ts: CACHE.ts,
      data: CACHE.data,
    });
  }

  try {
    const xmlData = await fetchOddsXML();

    CACHE = {
      ts: now(),
      data: xmlData,
    };

    return res.status(200).json({
      ok: true,
      cached: false,
      stale: false,
      ts: CACHE.ts,
      data: xmlData,
    });
  } catch (err) {
    if (CACHE.data) {
      return res.status(200).json({
        ok: true,
        cached: true,
        stale: true,
        ts: CACHE.ts,
        data: CACHE.data,
        ...(debug && {
          debug: { error: err.message },
        }),
      });
    }

    return res.status(200).json({
      ok: false,
      cached: false,
      stale: false,
      ts: 0,
      data: null,
      error: err.message,
    });
  }
}