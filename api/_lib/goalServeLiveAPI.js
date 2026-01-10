// api/_lib/goalServeLiveAPI.js
// Robust GoalServe Tennis fetcher:
// - Tries BOTH key formats: raw 32-hex and dashed GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
// - Always uses ?json=1 to avoid XML/gzip/xml2js headaches
// - Fallback feeds: home -> d1 -> d2 -> d-1 -> d-2 ...
// - Returns { matches, meta } where meta includes upstream diagnostics

import zlib from "zlib";

const READ_TIMEOUT_MS = 12000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function normalizeGuid(key) {
  if (!key) return null;
  const k = String(key).trim().replace(/-/g, "");
  if (k.length !== 32) return null;
  return `${k.slice(0, 8)}-${k.slice(8, 12)}-${k.slice(12, 16)}-${k.slice(16, 20)}-${k.slice(20)}`;
}

function isProbablyHtml(s) {
  const t = String(s || "").trim().toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html") || t.includes("<title>guid should contain");
}

function safeJsonParse(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e?.message || "json_parse_failed" };
  }
}

async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json,text/plain,*/*",
        "user-agent": "livebetiq3/goalserve-fetch (vercel)",
      },
      signal: ctl.signal,
    });

    const buf = Buffer.from(await res.arrayBuffer());
    const enc = (res.headers.get("content-encoding") || "").toLowerCase();
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    let text = "";
    if (enc.includes("gzip")) {
      text = zlib.gunzipSync(buf).toString("utf8");
    } else {
      text = buf.toString("utf8");
    }

    return {
      ok: res.ok,
      status: res.status,
      contentType: ct,
      encoding: enc || null,
      headers: {
        contentType: ct,
        contentEncoding: enc || null,
      },
      text,
    };
  } finally {
    clearTimeout(to);
  }
}

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

/**
 * Very defensive normalization for GoalServe tennis_scores JSON.
 * We keep only what UI typically needs; anything missing stays null.
 */
function normalizeGoalServeTennis(json) {
  // Common shapes:
  // { scores: { category: [...] } }
  // { tennis_scores: { category: [...] } }
  // sometimes category->match arrays
  const root =
    json?.scores ||
    json?.tennis_scores ||
    json?.data ||
    json;

  const categories = asArray(root?.category || root?.tournament || root?.leagues || []);
  const matches = [];

  for (const cat of categories) {
    const comp = cat?.name || cat?.league || cat?.["@name"] || cat?.["@league"] || null;
    const matchList = asArray(cat?.match || cat?.matches || cat?.event || cat?.game || []);
    for (const m of matchList) {
      const id =
        m?.id ||
        m?.["@id"] ||
        m?.match_id ||
        m?.event_id ||
        m?.fixture_id ||
        null;

      const status =
        m?.status ||
        m?.["@status"] ||
        m?.time ||
        m?.["@time"] ||
        null;

      const p1 =
        m?.player1?.name ||
        m?.player1 ||
        m?.home?.name ||
        m?.home ||
        m?.team1 ||
        m?.["@player1"] ||
        null;

      const p2 =
        m?.player2?.name ||
        m?.player2 ||
        m?.away?.name ||
        m?.away ||
        m?.team2 ||
        m?.["@player2"] ||
        null;

      const score =
        m?.score ||
        m?.["@score"] ||
        m?.result ||
        null;

      matches.push({
        id: id ? String(id) : null,
        comp: comp ? String(comp) : null,
        status: status ? String(status) : null,
        player1: p1 ? String(p1) : null,
        player2: p2 ? String(p2) : null,
        score: score ? String(score) : null,
        raw: m, // keep raw for downstream odds matching/debug
      });
    }
  }

  return matches;
}

function buildTennisUrl(key, path) {
  // Always request JSON output from GoalServe (per their doc)
  // Example: /tennis_scores/home?json=1
  const base = `https://www.goalserve.com/getfeed/${key}/tennis_scores/${path}`;
  return base.includes("?") ? `${base}&json=1` : `${base}?json=1`;
}

export async function fetchLiveTennis({ debug = false } = {}) {
  const RAW_KEY = process.env.GOALSERVE_KEY || process.env.GOALSERVE_TOKEN || "";
  const dashed = normalizeGuid(RAW_KEY);

  // We try both key shapes: raw and dashed.
  // Even if GoalServe doc lists raw, your upstream error demands dashed sometimes.
  const keyCandidates = uniq([String(RAW_KEY).trim(), dashed]);

  // Feed fallback order:
  // home: live
  // d1,d2: upcoming
  // d-1,d-2: recent history (useful when live is empty)
  const feedCandidates = ["home", "d1", "d2", "d-1", "d-2", "d3", "d-3"];

  const attempts = [];
  let lastErr = null;

  for (const key of keyCandidates) {
    if (!key) continue;

    for (const feed of feedCandidates) {
      const url = buildTennisUrl(key, feed);
      try {
        const r = await fetchText(url);

        const head = String(r.text || "").slice(0, 220);
        attempts.push({
          keyUsed: key,
          keyIsDashed: key.includes("-"),
          feed,
          url,
          ok: r.ok,
          status: r.status,
          contentType: r.contentType,
          encoding: r.encoding,
          head,
          isHtml: isProbablyHtml(r.text),
        });

        // If GoalServe returned HTML, it's NOT a valid feed. Try next.
        if (isProbablyHtml(r.text)) {
          lastErr = new Error("upstream_html_instead_of_json");
          continue;
        }

        // Parse JSON
        const parsed = safeJsonParse(r.text);
        if (!parsed.ok) {
          lastErr = new Error(parsed.error || "json_parse_failed");
          continue;
        }

        // Normalize
        const matches = normalizeGoalServeTennis(parsed.data);

        // Success criteria:
        // - We got valid JSON (no HTML)
        // - Return matches (could be empty; still valid feed)
        const meta = {
          build: "v10.2.5-tennis-live-keydual-json",
          now: new Date().toISOString(),
          tried: attempts,
          selected: { keyUsed: key, feed, url },
          counts: {
            matches: matches.length,
          },
          upstream: {
            ok: true,
            status: r.status,
            contentType: r.contentType,
            encoding: r.encoding,
          },
        };

        return { ok: true, matches, meta: debug ? meta : { build: meta.build, now: meta.now, counts: meta.counts } };
      } catch (e) {
        lastErr = e;
        attempts.push({
          keyUsed: key,
          keyIsDashed: key.includes("-"),
          feed,
          url: buildTennisUrl(key, feed),
          ok: false,
          status: null,
          error: e?.message || "fetch_failed",
        });
        await sleep(150);
      }
    }
  }

  // Total failure
  const meta = {
    build: "v10.2.5-tennis-live-keydual-json",
    now: new Date().toISOString(),
    tried: attempts,
    upstream: {
      ok: false,
      error: lastErr?.message || "unknown_error",
    },
    keyFormat: {
      rawLen: RAW_KEY ? String(RAW_KEY).replace(/-/g, "").length : 0,
      rawHasDashes: String(RAW_KEY || "").includes("-"),
      normalized: dashed || null,
    },
  };

  return { ok: false, matches: [], meta: debug ? meta : { build: meta.build, now: meta.now, upstream: meta.upstream } };
}