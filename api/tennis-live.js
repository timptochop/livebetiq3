// api/tennis-live.js
// Vercel Serverless Function (Node 18+)
// Goal: make "TODAY" correct for Cyprus by using tzOffsetMinutes=+120 by default.

import zlib from "zlib";
import { parseStringPromise } from "xml2js";

const DEFAULT_TZ_OFFSET_MINUTES = 120; // Cyprus (Asia/Nicosia) = UTC+2 in winter. Good enough for our “TODAY” bucketing.

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

function getTzOffsetMinutes(req) {
  // Allow override: ?tz=120 (minutes)
  const q = req?.query?.tz;
  const fromQuery = clampInt(q, -840, 840);
  if (fromQuery !== null) return fromQuery;

  // Default: Cyprus
  return DEFAULT_TZ_OFFSET_MINUTES;
}

function dayKeyFromMs(localMs) {
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function parseGoalServeDateTimeToUtcMs(dateStr, timeStr) {
  // GoalServe: "DD.MM.YYYY" + "HH:MM"
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

  if (
    !Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy) ||
    !Number.isFinite(hh) || !Number.isFinite(mi)
  ) return null;

  // IMPORTANT: this builds a UTC timestamp for that “clock time” as given by feed.
  // We later shift with tzOffsetMinutes to get local bucketing.
  const utcMs = Date.UTC(yyyy, mm - 1, dd, hh, mi, 0);
  return Number.isFinite(utcMs) ? utcMs : null;
}

function normalizePlayers(matchNode) {
  const p = matchNode?.player || [];
  const arr = Array.isArray(p) ? p : [p];

  // Keep only two sides, but don't crash if structure changes.
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
    if (!pl) continue;
    const s = [pl.s1, pl.s2, pl.s3, pl.s4, pl.s5].map((v) => String(v ?? "").trim());
    if (s.some((v) => v !== "")) return true;
  }
  return false;
}

function isLiveByStatus(statusRaw) {
  const s = toLower(statusRaw);
  // We explicitly DO NOT treat "1" as live.
  return s === "live" || s === "in progress" || s === "playing" || s === "started";
}

async function fetchGoalServeXml(url) {
  const r = await fetch(url, {
    headers: {
      "user-agent": "livebetiq3/tennis-live",
      "accept": "application/xml,text/xml,*/*",
      "accept-encoding": "gzip,deflate,br",
    },
  });

  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);

  // Handle gzip transparently
  const enc = (r.headers.get("content-encoding") || "").toLowerCase();
  let out = buf;
  if (enc.includes("gzip")) {
    out = zlib.gunzipSync(buf);
  }

  const text = out.toString("utf8");

  // Guard: GoalServe sometimes returns HTML error pages
  if (text.trim().startsWith("<html") || text.toLowerCase().includes("index was out of range")) {
    return { ok: false, error: "Upstream returned HTML/error instead of XML.", rawHead: text.slice(0, 200) };
  }

  return { ok: true, xml: text };
}

export default async function handler(req, res) {
  const debug = String(req.query?.debug || "") === "1";
  const tzOffsetMinutes = getTzOffsetMinutes(req);

  // Use your existing GoalServe key from env
  const key = process.env.GOALSERVE_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: "Missing GOALSERVE_KEY env var." });
  }

  // Canon endpoint (home)
  const url = `https://www.goalserve.com/getfeed/${key}/tennis_scores/home`;

  const nowUtcMs = Date.now();
  const nowLocalMs = nowUtcMs + tzOffsetMinutes * 60_000;
  const todayKey = dayKeyFromMs(nowLocalMs);

  try {
    const f = await fetchGoalServeXml(url);
    if (!f.ok) {
      return res.status(200).json({
        ok: true,
        mode: "EMPTY",
        matches: [],
        meta: {
          now: new Date(nowUtcMs).toISOString(),
          tzOffsetMinutes,
          todayKey,
          counts: { live: 0, today: 0, next24h: 0, upcoming7d: 0, total: 0 },
        },
        upstream: f,
      });
    }

    const parsed = await parseStringPromise(f.xml, { explicitArray: false, mergeAttrs: false });
    const root = parsed?.scores || parsed;

    const categoriesNode = root?.category || [];
    const categories = Array.isArray(categoriesNode) ? categoriesNode : [categoriesNode];

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
        const startLocalMs = startUtcMs !== null ? startUtcMs + tzOffsetMinutes * 60_000 : null;
        const dayKeyLocal = startLocalMs !== null ? dayKeyFromMs(startLocalMs) : null;
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
          s1: null, s2: null, s3: null, s4: null, s5: null,

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
      mode = "LIVE"; matches = live;
    } else if (today.length) {
      mode = "TODAY"; matches = today;
    } else if (next24h.length) {
      mode = "NEXT_24H"; matches = next24h;
    } else if (upcoming7d.length) {
      mode = "UPCOMING_7D"; matches = upcoming7d;
    }

    return res.status(200).json({
      ok: true,
      mode,
      matches,
      meta: {
        now: new Date(nowUtcMs).toISOString(),
        tzOffsetMinutes,
        todayKey,
        counts,
      },
      ...(debug
        ? {
            debug: {
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
              note: "Live heuristic: scoresPresent OR status in known live tokens. Status '1' is NOT treated as live.",
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