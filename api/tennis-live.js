// api/tennis-live.js
import zlib from "zlib";
import { parseStringPromise } from "xml2js";

const BUILD_TAG = "v10.1.5-gs-direct-handler-url-tz";
const DEFAULT_TZ_OFFSET_MINUTES = 120; // Cyprus winter (UTC+2)

const FINISHED = new Set([
  "finished",
  "cancelled",
  "retired",
  "abandoned",
  "postponed",
  "walk over",
]);

const toLower = (v) => String(v ?? "").trim().toLowerCase();
const isFinishedLike = (s) => FINISHED.has(toLower(s));

function clampInt(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(lo, Math.min(hi, Math.trunc(x)));
}

function getQueryParam(req, key) {
  try {
    const rawUrl = req?.url || "";
    const u = new URL(rawUrl, "http://localhost"); // base required
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

function getTzOffsetMinutes(req) {
  // 1) URL query (most reliable on Vercel)
  const tzFromUrl = getQueryParam(req, "tz");
  const fromUrl = clampInt(tzFromUrl, -840, 840);
  if (fromUrl !== null) return fromUrl;

  // 2) req.query (fallback)
  const tzFromQueryObj = req?.query?.tz;
  const fromQueryObj = clampInt(tzFromQueryObj, -840, 840);
  if (fromQueryObj !== null) return fromQueryObj;

  // 3) env (fallback)
  const fromEnv = clampInt(process.env.TZ_OFFSET_MINUTES, -840, 840);
  if (fromEnv !== null) return fromEnv;

  // 4) default
  return DEFAULT_TZ_OFFSET_MINUTES;
}

function dayKeyFromLocalMs(localMs) {
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function parseGoalServeDateTimeToUtcMs(dateStr, timeStr) {
  const d = String(dateStr || "").trim();
  const t = String(timeStr || "").trim();

  const m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const tm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || !tm) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const hh = Number(tm[1]);
  const mi = Number(tm[2]);

  if (![dd, mm, yyyy, hh, mi].every(Number.isFinite)) return null;
  return Date.UTC(yyyy, mm - 1, dd, hh, mi, 0);
}

function normalizePlayers(matchNode) {
  const p = matchNode?.player || [];
  const arr = Array.isArray(p) ? p : [p];

  return arr.slice(0, 2).map((x) => {
    const a = x?.$ || {};
    return {
      id: a.id || x?.id || null,
      name: a.name || x?.name || "",
      s1: x?.s1 ?? "",
      s2: x?.s2 ?? "",
      s3: x?.s3 ?? "",
      s4: x?.s4 ?? "",
      s5: x?.s5 ?? "",
    };
  });
}

function scoresPresent(players) {
  const p = Array.isArray(players) ? players : [];
  for (const pl of p) {
    const s = [pl?.s1, pl?.s2, pl?.s3, pl?.s4, pl?.s5].map((v) =>
      String(v ?? "").trim()
    );
    if (s.some((v) => v !== "")) return true;
  }
  return false;
}

function isLiveByStatus(statusRaw) {
  const s = toLower(statusRaw);
  return (
    s === "live" ||
    s === "in progress" ||
    s === "playing" ||
    s === "started"
  );
}

async function fetchGoalServeXml(url) {
  const r = await fetch(url, {
    headers: {
      "user-agent": "livebetiq3/tennis-live",
      accept: "application/xml,text/xml,*/*",
      "accept-encoding": "gzip,deflate,br",
    },
  });

  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);

  const enc = (r.headers.get("content-encoding") || "").toLowerCase();
  let out = buf;
  if (enc.includes("gzip")) out = zlib.gunzipSync(buf);

  const text = out.toString("utf8");

  if (
    text.trim().startsWith("<html") ||
    text.toLowerCase().includes("index was out of range")
  ) {
    return {
      ok: false,
      error: "Upstream returned HTML/error instead of XML.",
      rawHead: text.slice(0, 220),
    };
  }

  return { ok: true, xml: text };
}

export default async function handler(req, res) {
  const debug = String(getQueryParam(req, "debug") || req?.query?.debug || "") === "1";
  const tzOffsetMinutes = getTzOffsetMinutes(req);

  const key = process.env.GOALSERVE_KEY;
  if (!key) {
    return res
      .status(500)
      .json({ ok: false, error: "Missing GOALSERVE_KEY env var." });
  }

  const url = `https://www.goalserve.com/getfeed/${key}/tennis_scores/home`;

  const nowUtcMs = Date.now();
  const nowLocalMs = nowUtcMs + tzOffsetMinutes * 60_000;
  const todayKey = dayKeyFromLocalMs(nowLocalMs);

  try {
    const f = await fetchGoalServeXml(url);
    if (!f.ok) {
      return res.status(200).json({
        ok: true,
        mode: "EMPTY",
        matches: [],
        meta: {
          build: BUILD_TAG,
          now: new Date(nowUtcMs).toISOString(),
          tzOffsetMinutes,
          todayKey,
          counts: { live: 0, today: 0, next24h: 0, upcoming7d: 0, total: 0 },
        },
        upstream: f,
        ...(debug
          ? {
              debug: {
                rawUrl: req?.url || null,
                tzSeenUrl: getQueryParam(req, "tz"),
                tzSeenQueryObj: req?.query?.tz ?? null,
                tzSeenEnv: process.env.TZ_OFFSET_MINUTES ?? null,
              },
            }
          : {}),
      });
    }

    const parsed = await parseStringPromise(f.xml, {
      explicitArray: false,
      mergeAttrs: false,
    });
    const root = parsed?.scores || parsed;

    const categoriesNode = root?.category || [];
    const categories = Array.isArray(categoriesNode)
      ? categoriesNode
      : [categoriesNode];

    const all = [];

    for (const c of categories) {
      const cAttr = c?.$ || {};
      const categoryId = cAttr.id || null;
      const categoryName = cAttr.name || c?.name || "";

      const matchesNode = c?.match || [];
      const matches = Array.isArray(matchesNode) ? matchesNode : [matchesNode];

      for (const m of matches) {
        if (!m) continue;

        const a = m?.$ || {};
        const id = a.id || null;
        const date = a.date || m?.date || "";
        const time = a.time || m?.time || "";
        const statusRaw = a.status ?? m?.status ?? "";

        if (isFinishedLike(statusRaw)) continue;

        const players = normalizePlayers(m);
        const _scoresPresent = scoresPresent(players);
        const _liveByStatus = isLiveByStatus(statusRaw);

        const startUtcMs = parseGoalServeDateTimeToUtcMs(date, time);
        const startLocalMs =
          startUtcMs !== null ? startUtcMs + tzOffsetMinutes * 60_000 : null;
        const dayKeyLocal =
          startLocalMs !== null ? dayKeyFromLocalMs(startLocalMs) : null;
        const startsInMs = startUtcMs !== null ? startUtcMs - nowUtcMs : null;

        const isLive = _scoresPresent || _liveByStatus;

        all.push({
          id,
          date,
          time,
          status: String(statusRaw ?? ""),
          statusRaw: String(statusRaw ?? ""),
          categoryId,
          categoryName,
          players,
          isLive,
          setNum: null,
          s1: null,
          s2: null,
          s3: null,
          s4: null,
          s5: null,
          _scoresPresent,
          _liveByStatus,
          startUtcMs,
          startLocalMs,
          startsInMs,
          dayKeyLocal,
          _nowLocalMs: nowLocalMs,
        });
      }
    }

    const live = all.filter((m) => m.isLive);

    const today = all.filter((m) => !m.isLive && m.dayKeyLocal === todayKey);

    const next24h = all.filter((m) => {
      if (m.isLive) return false;
      if (!Number.isFinite(m.startUtcMs)) return false;
      const dt = m.startUtcMs - nowUtcMs;
      return dt > 0 && dt <= 24 * 60 * 60 * 1000;
    });

    const upcoming7d = all.filter((m) => {
      if (m.isLive) return false;
      if (!Number.isFinite(m.startUtcMs)) return false;
      const dt = m.startUtcMs - nowUtcMs;
      return dt > 0 && dt <= 7 * 24 * 60 * 60 * 1000;
    });

    const counts = {
      live: live.length,
      today: today.length,
      next24h: next24h.length,
      upcoming7d: upcoming7d.length,
      total: all.length,
    };

    let mode = "EMPTY";
    let matches = [];
    if (live.length) {
      mode = "LIVE";
      matches = live;
    } else if (today.length) {
      mode = "TODAY";
      matches = today;
    } else if (next24h.length) {
      mode = "NEXT_24H";
      matches = next24h;
    } else if (upcoming7d.length) {
      mode = "UPCOMING_7D";
      matches = upcoming7d;
    }

    return res.status(200).json({
      ok: true,
      mode,
      matches,
      meta: {
        build: BUILD_TAG,
        now: new Date(nowUtcMs).toISOString(),
        tzOffsetMinutes,
        todayKey,
        counts,
      },
      ...(debug
        ? {
            debug: {
              rawUrl: req?.url || null,
              tzSeenUrl: getQueryParam(req, "tz"),
              tzSeenQueryObj: req?.query?.tz ?? null,
              tzSeenEnv: process.env.TZ_OFFSET_MINUTES ?? null,
              sample: matches.slice(0, 5).map((x) => ({
                id: x.id,
                date: x.date,
                time: x.time,
                statusRaw: x.statusRaw,
                isLive: x.isLive,
                scoresPresent: x._scoresPresent,
                liveByStatus: x._liveByStatus,
                startsInMs: x.startsInMs,
                dayKeyLocal: x.dayKeyLocal,
              })),
              note:
                "TZ is parsed from req.url first (URLSearchParams), then req.query, then env, then default. Status '1' is NOT treated as live.",
            },
          }
        : {}),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Unhandled exception in tennis-live handler.",
      message: String(e?.message || e),
    });
  }
}