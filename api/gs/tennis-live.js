// api/gs/tennis-live.js
// Vercel Serverless Function
// Goal: Fetch GoalServe tennis feeds with deterministic fallback + dual key format (raw + GUID)
// Returns: { ok, mode, matches, meta }

import zlib from "zlib";

const READ_TIMEOUT_MS = 12000;

function withTimeout(ms) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ms);
  return { ctl, to };
}

function toGuid32(raw32) {
  const s = String(raw32 || "").trim();
  if (s.length !== 32) return null;
  // 8-4-4-4-12
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function normalizeKeys(envKey) {
  const raw = String(envKey || "").trim();
  const guid = toGuid32(raw);
  // order matters: try raw first (matches GoalServe feed examples), then GUID
  const keys = [];
  if (raw) keys.push({ key: raw, label: raw.length === 32 ? "raw32" : `raw${raw.length}` });
  if (guid) keys.push({ key: guid, label: "guid32" });
  // de-dupe
  const seen = new Set();
  return keys.filter((k) => {
    const id = k.key;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function safeJsonParse(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function maybeGunzip(buf, encoding) {
  const enc = String(encoding || "").toLowerCase();
  if (enc.includes("gzip")) {
    try {
      return zlib.gunzipSync(buf);
    } catch {
      return buf;
    }
  }
  return buf;
}

async function fetchBuffer(url) {
  const { ctl, to } = withTimeout(READ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctl.signal,
      headers: {
        Accept: "application/json,application/xml,text/xml,text/plain,*/*",
        "Accept-Encoding": "gzip,deflate",
        "User-Agent": "livebetiq3/tennis-live",
      },
    });

    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);

    return {
      ok: res.ok,
      status: res.status,
      headers: {
        encoding: res.headers.get("content-encoding") || "",
        contentType: res.headers.get("content-type") || "",
      },
      buf,
    };
  } finally {
    clearTimeout(to);
  }
}

function extractMatchesFromGoalServeJson(json) {
  // GoalServe JSON shapes vary. We normalize defensively.
  // Common: { scores: { category: [...] } } or { scores: { category: {...}} }
  const root = json && typeof json === "object" ? json : null;
  if (!root) return [];

  const scores = root.scores || root.Scores || root.data || root;
  if (!scores) return [];

  const cat = scores.category || scores.categories || scores.tournament || scores;
  const categories = Array.isArray(cat) ? cat : cat ? [cat] : [];

  const out = [];
  for (const c of categories) {
    const leagues = c.league || c.leagues || c.tournament || c;
    const leagueArr = Array.isArray(leagues) ? leagues : leagues ? [leagues] : [];

    for (const l of leagueArr) {
      const matches = l.match || l.matches || l.event || l.events || [];
      const matchArr = Array.isArray(matches) ? matches : matches ? [matches] : [];
      for (const m of matchArr) {
        // Keep raw payload; UI layer already knows how to normalize.
        out.push(m);
      }
    }
  }
  return out;
}

async function tryOne(url) {
  const r = await fetchBuffer(url);
  const rawBuf = maybeGunzip(r.buf, r.headers.encoding);
  const text = rawBuf.toString("utf-8");

  // JSON-first (because we force ?json=1)
  const j = safeJsonParse(text);
  const isHtml = /<html/i.test(text) || /<!doctype html/i.test(text);

  return {
    ok: r.ok,
    status: r.status,
    contentType: r.headers.contentType,
    encoding: r.headers.encoding,
    isHtml,
    textPreview: text.slice(0, 700),
    json: j,
    matches: j ? extractMatchesFromGoalServeJson(j) : [],
  };
}

function buildFeedUrls(key, which) {
  // We force JSON output to reduce XML parsing + gzip ambiguity.
  const baseHttp = "http://www.goalserve.com/getfeed";
  const baseHttps = "https://www.goalserve.com/getfeed";

  const pathsByMode = {
    home: "tennis_scores/home",
    itf: "tennis_scores/itf",
    d1: "tennis_scores/d1",
    d2: "tennis_scores/d2",
    d3: "tennis_scores/d3",
    "d-1": "tennis_scores/d-1",
  };

  const path = pathsByMode[which] || pathsByMode.home;

  // Try HTTPS first, then HTTP (some accounts behave weirdly with redirects/certs)
  return [
    `${baseHttps}/${key}/${path}?json=1`,
    `${baseHttp}/${key}/${path}?json=1`,
  ];
}

export default async function handler(req, res) {
  const build = "v10.3.0-tennis-live-dualkey-json-fallback";
  const now = new Date().toISOString();
  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const debug = String(req.query?.debug || "") === "1";
  const forcedMode = String(req.query?.mode || "").trim(); // optional: home|d1|d2|itf|d-1

  try {
    const envKey = process.env.GOALSERVE_KEY || process.env.GOALSERVE_TOKEN || "";
    const keys = normalizeKeys(envKey);

    if (!keys.length) {
      res.status(500).json({
        ok: false,
        mode: "ERROR",
        matches: [],
        meta: { build, now, tzOffsetMinutes, error: "missing_GOALSERVE_KEY_or_GOALSERVE_TOKEN" },
      });
      return;
    }

    // Deterministic fallback ladder:
    // If user forces mode -> only that
    // else: home -> itf -> d1 -> d2 -> d3 -> d-1
    const ladder = forcedMode
      ? [forcedMode]
      : ["home", "itf", "d1", "d2", "d3", "d-1"];

    const attempts = [];

    for (const mode of ladder) {
      for (const k of keys) {
        const urls = buildFeedUrls(k.key, mode);

        for (const url of urls) {
          const r = await tryOne(url);

          attempts.push({
            mode,
            keyLabel: k.label,
            url,
            ok: r.ok,
            status: r.status,
            contentType: r.contentType,
            encoding: r.encoding,
            isHtml: r.isHtml,
            preview: r.textPreview,
            matchesFound: r.matches.length,
          });

          // Success criteria:
          // - HTTP ok
          // - not HTML error
          // - any matches OR (even if 0) we accept if not HTML, to avoid endless loops
          if (r.ok && !r.isHtml) {
            // If matches is 0, we still return but mark mode for transparency.
            res.status(200).json({
              ok: true,
              mode: r.matches.length ? mode : `EMPTY:${mode}`,
              matches: r.matches,
              meta: {
                build,
                now,
                tzOffsetMinutes,
                used: { mode, keyLabel: k.label },
                attempts: debug ? attempts : undefined,
              },
            });
            return;
          }
        }
      }
    }

    // If all failed -> return full diagnostic (no guesswork)
    res.status(200).json({
      ok: true,
      mode: "EMPTY",
      matches: [],
      meta: {
        build,
        now,
        tzOffsetMinutes,
        error: "All upstream attempts returned HTML or non-OK responses",
        attempts: attempts,
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      mode: "ERROR",
      matches: [],
      meta: {
        build,
        now,
        tzOffsetMinutes,
        error: "handler_exception",
        message: err?.message || "unknown_error",
      },
    });
  }
}