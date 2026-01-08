// api/_lib/goalServeLiveAPI.js
// GoalServe Tennis Live fetcher (Vercel) with GUID key normalization + gzip + JSON/XML guard
// Build: v10.2.5-tennis-live-guidkey-normalize

import { gunzipSync } from "zlib";
import { parseStringPromise } from "xml2js";

const READ_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeGuidKey(keyRaw) {
  const k = String(keyRaw || "").trim();
  if (!k) return "";

  // Already dashed GUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) {
    return k.toLowerCase();
  }

  // 32-hex (no dashes) -> insert dashes
  if (/^[0-9a-f]{32}$/i.test(k)) {
    const x = k.toLowerCase();
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
  }

  // Unknown format, return as-is (but upstream may fail)
  return k;
}

async function fetchWithTimeout(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctl.signal,
      headers: {
        Accept: "application/xml,text/xml,application/json,text/plain,*/*",
        "User-Agent": "livebetiq3/tennis-live (vercel)",
      },
      cache: "no-store",
    });

    const status = res.status;
    const contentType = res.headers.get("content-type") || "";
    const encoding = res.headers.get("content-encoding") || "";

    let buf = Buffer.from(await res.arrayBuffer());
    if (String(encoding).toLowerCase().includes("gzip")) {
      try {
        buf = gunzipSync(buf);
      } catch {
        // keep raw if gunzip fails
      }
    }

    const text = buf.toString("utf8");
    return { status, contentType, encoding, text };
  } finally {
    clearTimeout(to);
  }
}

function normalizeArray(x) {
  if (Array.isArray(x)) return x;
  if (x === null || x === undefined) return [];
  return [x];
}

function extractMatchesFromJson(json) {
  const scores = json?.scores || json;
  const categories = normalizeArray(scores?.category);

  const out = [];
  for (const cat of categories) {
    if (!cat) continue;
    const catName = cat?.name || cat?.["@name"] || cat?.id || cat?.["@id"] || "";

    const matches = normalizeArray(cat?.match);
    for (const m of matches) {
      if (!m) continue;
      out.push({
        ...m,
        categoryName: m.categoryName || catName,
      });
    }
  }
  return out;
}

function extractMatchesFromXmlParsed(parsed) {
  const scores = parsed?.scores || parsed;
  const categories = normalizeArray(scores?.category);

  const out = [];
  for (const cat of categories) {
    if (!cat) continue;
    const catName = cat?.$?.name || cat?.name || cat?.$?.id || "";

    const matches = normalizeArray(cat?.match);
    for (const m of matches) {
      if (!m) continue;

      // xml2js usually keeps attrs in "$"
      const mapped = { ...m };
      if (m.$ && typeof m.$ === "object") {
        for (const [k, v] of Object.entries(m.$)) {
          mapped[`@${k}`] = v;
        }
      }

      mapped.categoryName = mapped.categoryName || catName;
      out.push(mapped);
    }
  }
  return out;
}

function countLiveUpcoming(matches) {
  const FINISHED = new Set(["finished", "cancelled", "retired", "abandoned", "postponed", "walk over"]);
  const toLower = (v) => String(v ?? "").trim().toLowerCase();
  const isFinishedLike = (s) => FINISHED.has(toLower(s));
  const isUpcomingLike = (s) => {
    const x = toLower(s);
    return x === "not started" || x === "scheduled" || x === "upcoming" || x === "ns" || x === "0" || x === "pending";
  };

  let live = 0;
  let upcoming = 0;

  for (const m of matches) {
    const st = m?.status || m?.["@status"] || "";
    if (isFinishedLike(st)) continue;
    if (isUpcomingLike(st)) upcoming++;
    else live++;
  }

  return { live, upcoming, total: matches.length };
}

export async function fetchLiveTennis(opts = {}) {
  const debugOn = !!opts.debug;

  const build = "v10.2.5-tennis-live-guidkey-normalize";
  const nowIso = new Date().toISOString();
  const tzOffsetMinutes = 0;

  const keyEnv =
    process.env.GOALSERVE_KEY ||
    process.env.GS_KEY ||
    process.env.GOALSERVE_API_KEY ||
    process.env.GOALSERVE_TOKEN ||
    "";

  const key = normalizeGuidKey(keyEnv);

  const upstreamUrl = `https://www.goalserve.com/getfeed/${encodeURIComponent(
    key
  )}/tennis_scores/home?json=1`;

  // small retry (GoalServe sometimes blips)
  let last = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    last = await fetchWithTimeout(upstreamUrl);
    if (last.status >= 200 && last.status < 300 && last.text && last.text.length > 10) break;
    await sleep(250);
  }

  const { status, contentType, encoding, text } = last || {
    status: 0,
    contentType: "",
    encoding: "",
    text: "",
  };

  // Hard guard: HTML means upstream rejected us (usually key format or permissions)
  const looksHtml = /<html|<!doctype html/i.test(text || "") || String(contentType).toLowerCase().includes("text/html");
  if (looksHtml) {
    const hint =
      text && text.toLowerCase().includes("guid should contain")
        ? "Upstream rejected key: GoalServe expects dashed GUID format."
        : "Upstream returned HTML/error page instead of XML/JSON.";

    const out = {
      ok: true,
      mode: "EMPTY",
      matches: [],
      meta: {
        build,
        now: nowIso,
        tzOffsetMinutes,
        todayKey: nowIso.slice(0, 10),
        counts: { live: 0, today: 0, next24h: 0, upcoming7d: 0, total: 0 },
      },
      upstream: { ok: false, error: hint },
      debug: debugOn
        ? {
            upstreamStatus: status,
            upstreamEncoding: encoding || null,
            contentType: contentType || null,
            keyFormat: key ? (key.includes("-") ? "GUID_DASHED" : "RAW") : "MISSING",
            rawLen: (text || "").length,
            sample: String(text || "").slice(0, 220),
          }
        : undefined,
    };

    return out;
  }

  // Try JSON first (we requested ?json=1)
  let matches = [];
  let parsedKind = null;

  try {
    const j = JSON.parse(text);
    matches = extractMatchesFromJson(j);
    parsedKind = "json";
  } catch {
    // fallback XML parse
    try {
      const xmlParsed = await parseStringPromise(text, {
        explicitArray: false,
        mergeAttrs: false,
        attrkey: "$",
        charkey: "_",
        trim: true,
      });
      matches = extractMatchesFromXmlParsed(xmlParsed);
      parsedKind = "xml";
    } catch (e) {
      const out = {
        ok: true,
        mode: "EMPTY",
        matches: [],
        meta: {
          build,
          now: nowIso,
          tzOffsetMinutes,
          todayKey: nowIso.slice(0, 10),
          counts: { live: 0, today: 0, next24h: 0, upcoming7d: 0, total: 0 },
        },
        upstream: { ok: false, error: "Could not parse upstream as JSON or XML." },
        debug: debugOn
          ? {
              upstreamStatus: status,
              upstreamEncoding: encoding || null,
              contentType: contentType || null,
              parsedKind: "none",
              parseError: String(e?.message || e),
              rawLen: (text || "").length,
              sample: String(text || "").slice(0, 220),
            }
          : undefined,
      };
      return out;
    }
  }

  const counts = countLiveUpcoming(matches);

  const out = {
    ok: true,
    mode: matches.length ? "OK" : "EMPTY",
    matches,
    meta: {
      build,
      now: nowIso,
      tzOffsetMinutes,
      todayKey: nowIso.slice(0, 10),
      counts,
    },
    upstream: {
      ok: status >= 200 && status < 300,
      status,
      encoding: encoding || null,
      contentType: contentType || null,
      parsedKind,
    },
    debug: debugOn
      ? {
          upstreamUrlMasked: upstreamUrl.replace(key, "***KEY***"),
          keyFormat: key ? (key.includes("-") ? "GUID_DASHED" : "RAW") : "MISSING",
          rawLen: (text || "").length,
        }
      : undefined,
  };

  return out;
}

export default { fetchLiveTennis };