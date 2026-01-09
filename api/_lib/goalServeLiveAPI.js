// api/_lib/goalServeLiveAPI.js
// GoalServe fetcher with GUID key fallback (dashed <-> raw) + gzip + XML guard + debug transparency

import { gunzipSync } from "zlib";
import { parseStringPromise } from "xml2js";

const READ_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isHex32(s) {
  return /^[a-f0-9]{32}$/i.test(String(s || "").trim());
}

function isGuidDashed(s) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    String(s || "").trim()
  );
}

function toDashedGuid(hex32) {
  const s = String(hex32 || "").trim().toLowerCase().replace(/-/g, "");
  if (!isHex32(s)) return null;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function toRawHex32(guidDashed) {
  const s = String(guidDashed || "").trim().toLowerCase();
  if (!isGuidDashed(s)) return null;
  return s.replace(/-/g, "");
}

function normalizeArray(x) {
  if (Array.isArray(x)) return x;
  if (x == null) return [];
  return [x];
}

function safeText(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (typeof x === "object" && typeof x._ === "string") return x._;
  return String(x);
}

async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctl.signal,
      headers: {
        Accept: "application/xml,text/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1",
        "Accept-Encoding": "gzip,deflate",
        "User-Agent": "livebetiq3/tennis-live (vercel)",
      },
      cache: "no-store",
    });

    const status = res.status;
    const contentType = res.headers.get("content-type") || null;
    const encoding = res.headers.get("content-encoding") || null;

    const buf = Buffer.from(await res.arrayBuffer());
    let text = "";

    try {
      if (encoding && String(encoding).toLowerCase().includes("gzip")) {
        text = gunzipSync(buf).toString("utf8");
      } else {
        text = buf.toString("utf8");
      }
    } catch {
      // fallback
      text = buf.toString("utf8");
    }

    return { ok: res.ok, status, contentType, encoding, text };
  } finally {
    clearTimeout(to);
  }
}

function looksLikeHtmlError(text) {
  const t = String(text || "");
  return /<html/i.test(t) || /<title>/i.test(t);
}

function hasGuidFormatError(text) {
  const t = String(text || "");
  return /Guid should contain 32 digits with 4 dashes/i.test(t);
}

function buildFeedUrl(key, path = "tennis_scores/home") {
  const k = String(key || "").trim();
  return `https://www.goalserve.com/getfeed/${k}/${path}`;
}

function normalizeMatchesFromParsed(parsed) {
  // GoalServe tennis_scores/home is usually:
  // scores -> category[] -> matches/match -> match[]
  const raw = parsed || {};
  const scores = raw.scores || raw;
  const categories = normalizeArray(scores.category);

  const matches = [];

  for (const cat of categories) {
    if (!cat) continue;

    const catName = safeText(cat.name || cat["@name"] || cat.id || cat["@id"]);
    const matchesContainer = cat.matches || cat.match || {};
    const arr = normalizeArray(matchesContainer.match || matchesContainer);

    for (const m of arr) {
      if (!m) continue;

      const id = safeText(m.id || m.matchid || m["@id"] || m["@matchid"]);
      const status = safeText(m.status || m["@status"]);
      const date = safeText(m.date || m["@date"]);
      const time = safeText(m.time || m["@time"]);

      const players = normalizeArray(m.player || m.players).map((p) => {
        const obj = p || {};
        return {
          name: safeText(obj.name || obj["@name"] || obj._),
          s1: safeText(obj.s1 || obj["@s1"] || obj.set1 || obj["@set1"]),
          s2: safeText(obj.s2 || obj["@s2"] || obj.set2 || obj["@set2"]),
          s3: safeText(obj.s3 || obj["@s3"] || obj.set3 || obj["@set3"]),
          s4: safeText(obj.s4 || obj["@s4"] || obj.set4 || obj["@set4"]),
          s5: safeText(obj.s5 || obj["@s5"] || obj.set5 || obj["@set5"]),
        };
      });

      matches.push({
        id: id || null,
        status,
        date,
        time,
        categoryName: catName || "",
        player: players, // keep legacy shape compatibility
        players, // also provide normalized convenience
        raw: m,
      });
    }
  }

  return matches;
}

/**
 * Main entry used by /api/gs/tennis-live
 * Returns:
 * { ok, mode, matches, meta, debug? }
 */
export async function fetchLiveTennis({ debug = false } = {}) {
  const envKey =
    process.env.GOALSERVE_KEY ||
    process.env.GOALSERVE_API_KEY ||
    process.env.GS_KEY ||
    process.env.REACT_APP_GOALSERVE_KEY ||
    "";

  const rawKey = String(envKey || "").trim();

  // Build candidate keys in a deterministic order:
  // If env is hex32 => try dashed first (because your upstream complains about dashed),
  // then raw as fallback. If env is dashed => try dashed then raw.
  // If env is something else => try as-is.
  const dashed = isHex32(rawKey) ? toDashedGuid(rawKey) : isGuidDashed(rawKey) ? rawKey : null;
  const raw32 = isGuidDashed(rawKey) ? toRawHex32(rawKey) : isHex32(rawKey) ? rawKey : null;

  const candidates = [];
  if (dashed) candidates.push({ key: dashed, format: "dashed" });
  if (raw32) candidates.push({ key: raw32, format: "raw32" });
  if (!candidates.length && rawKey) candidates.push({ key: rawKey, format: "as-is" });

  const meta = {
    build: "v10.2.5-tennis-live-guid-fallback",
    now: new Date().toISOString(),
    tzOffsetMinutes: 0,
    candidates: candidates.map((c) => ({ format: c.format, len: String(c.key || "").length })),
  };

  const debugOut = {
    attempts: [],
    upstreamStatus: null,
    upstreamEncoding: null,
    contentType: null,
    picked: null,
    error: null,
    rawHead: null,
  };

  if (!candidates.length) {
    return {
      ok: false,
      mode: "EMPTY",
      matches: [],
      meta,
      debug: debug ? { ...debugOut, error: "missing_api_key" } : undefined,
      error: "missing_api_key",
    };
  }

  // Endpoints to try (you can extend later; keep minimal now)
  const pathsToTry = ["tennis_scores/home"];

  // Try combinations: key candidate x path
  for (const c of candidates) {
    for (const path of pathsToTry) {
      const url = buildFeedUrl(c.key, path);

      let resp;
      try {
        resp = await fetchText(url);
      } catch (e) {
        debugOut.attempts.push({
          url,
          keyFormat: c.format,
          ok: false,
          status: null,
          err: String(e?.message || e),
        });
        continue;
      }

      debugOut.upstreamStatus = resp.status;
      debugOut.upstreamEncoding = resp.encoding;
      debugOut.contentType = resp.contentType;

      const head = String(resp.text || "").slice(0, 220);
      debugOut.rawHead = head;

      debugOut.attempts.push({
        url,
        keyFormat: c.format,
        ok: resp.ok,
        status: resp.status,
        encoding: resp.encoding,
        contentType: resp.contentType,
        head,
      });

      // If HTML error, continue trying other candidates
      if (looksLikeHtmlError(resp.text)) {
        // Special-case: if we got the GUID format error, it strongly implies wrong key format.
        // Continue to next candidate.
        if (hasGuidFormatError(resp.text)) {
          await sleep(150);
          continue;
        }
        await sleep(150);
        continue;
      }

      // If not OK status, continue
      if (!resp.ok) {
        await sleep(150);
        continue;
      }

      // Parse XML
      let parsed;
      try {
        parsed = await parseStringPromise(resp.text, {
          explicitArray: false,
          mergeAttrs: true,
          trim: true,
        });
      } catch (e) {
        await sleep(150);
        continue;
      }

      const matches = normalizeMatchesFromParsed(parsed);

      debugOut.picked = { url, keyFormat: c.format, path };

      return {
        ok: true,
        mode: matches.length ? "LIVE" : "EMPTY",
        matches,
        meta: { ...meta, counts: { total: matches.length } },
        debug: debug ? debugOut : undefined,
      };
    }
  }

  debugOut.error = "Upstream returned HTML/error instead of XML (or XML parse failed).";

  return {
    ok: false,
    mode: "EMPTY",
    matches: [],
    meta: { ...meta, counts: { total: 0 } },
    debug: debug ? debugOut : undefined,
    error: "upstream_failed",
  };
}

export default fetchLiveTennis;