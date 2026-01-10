// api/_lib/goalServeLiveAPI.js
// Principal fix: DO NOT normalize/format-shift GoalServe credentials.
// Token (32 hex) must stay raw. GUID must stay dashed.

import zlib from "zlib";
import { parseStringPromise } from "xml2js";

const READ_TIMEOUT_MS = 12000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function classifyKey(raw) {
  const s = String(raw || "").trim();
  const isToken32Hex = /^[a-f0-9]{32}$/i.test(s);
  const isGuidDashed = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
  return {
    raw: s,
    kind: isToken32Hex ? "token32" : isGuidDashed ? "guid" : s ? "invalid" : "missing",
  };
}

async function fetchWithTimeout(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": "livebetiq3/goalserve-probe",
        accept: "*/*",
      },
      signal: ctl.signal,
    });

    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const headers = {};
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

    return { ok: res.ok, status: res.status, headers, buf };
  } finally {
    clearTimeout(to);
  }
}

function maybeGunzip(buf, headers) {
  const enc = String(headers["content-encoding"] || "").toLowerCase();
  if (enc.includes("gzip")) return zlib.gunzipSync(buf);
  return buf;
}

function looksLikeHtml(buf) {
  const t = buf.toString("utf8", 0, 240).toLowerCase();
  return t.includes("<html") || t.includes("<!doctype") || t.includes("<title");
}

function tinyPreview(buf, n = 500) {
  const s = buf.toString("utf8", 0, n);
  return s.replace(/\s+/g, " ").trim();
}

// Minimal normalization: keep it safe; UI/AI can re-shape later.
function extractMatches(parsed) {
  // GoalServe tennis_scores/home typically has: scores -> category -> match
  const scores = parsed?.scores;
  const cats = scores?.category ? (Array.isArray(scores.category) ? scores.category : [scores.category]) : [];
  const out = [];

  for (const c of cats) {
    const matches = c?.match ? (Array.isArray(c.match) ? c.match : [c.match]) : [];
    for (const m of matches) out.push(m);
  }
  return out;
}

async function tryUrl(label, url) {
  const r = await fetchWithTimeout(url);
  const body = maybeGunzip(r.buf, r.headers);

  const contentType = String(r.headers["content-type"] || "");
  const html = looksLikeHtml(body);

  if (html || contentType.includes("text/html")) {
    return {
      ok: false,
      label,
      url,
      status: r.status,
      contentType,
      reason: "upstream_html_instead_of_xml",
      preview: tinyPreview(body),
    };
  }

  // Try XML parse
  try {
    const xml = body.toString("utf8");
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });

    const matches = extractMatches(parsed);

    return {
      ok: true,
      label,
      url,
      status: r.status,
      contentType,
      matches,
    };
  } catch (e) {
    return {
      ok: false,
      label,
      url,
      status: r.status,
      contentType,
      reason: "xml_parse_failed",
      message: e?.message || "xml_parse_failed",
      preview: tinyPreview(body),
    };
  }
}

export async function fetchLiveTennis({ debug = false } = {}) {
  const tzOffsetMinutes = 0;

  const tokenEnv = classifyKey(process.env.GOALSERVE_TOKEN);
  const keyEnv = classifyKey(process.env.GOALSERVE_KEY);

  // IMPORTANT: we NEVER transform the credential string.
  // We only choose which one to use based on strict format.
  const attempts = [];

  // Prefer token if valid token32
  if (tokenEnv.kind === "token32") {
    attempts.push({
      label: "token32",
      url: `https://www.goalserve.com/getfeed/${tokenEnv.raw}/tennis_scores/home`,
    });
  }

  // Then try guid if valid guid
  if (keyEnv.kind === "guid") {
    attempts.push({
      label: "guid",
      url: `https://www.goalserve.com/getfeed/${keyEnv.raw}/tennis_scores/home`,
    });
  }

  // If neither valid, fail fast with explicit diagnosis (this is OUR fix)
  if (attempts.length === 0) {
    return {
      ok: true,
      mode: "EMPTY",
      matches: [],
      meta: {
        build: "v10.3.0-strict-key-classifier",
        tzOffsetMinutes,
        upstream: "none",
        error: "no_valid_goalserve_credentials",
        keyKinds: { GOALSERVE_TOKEN: tokenEnv.kind, GOALSERVE_KEY: keyEnv.kind },
        note: "Token must be 32 hex chars. GUID must be dashed format. No normalization applied.",
      },
    };
  }

  const results = [];
  for (const a of attempts) {
    const r = await tryUrl(a.label, a.url);
    results.push(r);
    if (r.ok) {
      return {
        ok: true,
        mode: r.matches?.length ? "OK" : "EMPTY",
        matches: r.matches || [],
        meta: {
          build: "v10.3.0-strict-key-classifier",
          tzOffsetMinutes,
          upstream: a.label,
          status: r.status,
          contentType: r.contentType,
          ...(debug
            ? {
                debug: {
                  attempts: results,
                  keyKinds: { GOALSERVE_TOKEN: tokenEnv.kind, GOALSERVE_KEY: keyEnv.kind },
                },
              }
            : {}),
        },
      };
    }
    await sleep(120); // tiny backoff
  }

  return {
    ok: true,
    mode: "EMPTY",
    matches: [],
    meta: {
      build: "v10.3.0-strict-key-classifier",
      tzOffsetMinutes,
      upstream: "failed",
      error: "all_attempts_failed",
      ...(debug
        ? {
            debug: {
              attempts: results,
              keyKinds: { GOALSERVE_TOKEN: tokenEnv.kind, GOALSERVE_KEY: keyEnv.kind },
            },
          }
        : {}),
    },
  };
}