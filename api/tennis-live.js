import { fetchLiveTennis } from "./_lib/goalServeLiveAPI.js";

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function parseTzOffsetMinutes(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-840, Math.min(840, Math.trunc(n)));
}

function parseDateTimeToMs(dateStr, timeStr, tzOffsetMinutes) {
  // GoalServe: date "DD.MM.YYYY", time "HH:MM"
  if (!dateStr || !timeStr) return null;
  const m = String(dateStr).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const t = String(timeStr).match(/^(\d{2}):(\d{2})$/);
  if (!m || !t) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = Number(t[1]);
  const MM = Number(t[2]);

  if (![dd, mm, yyyy, HH, MM].every(Number.isFinite)) return null;

  // Interpret the match time as "local time at tzOffsetMinutes"
  // then convert to UTC ms.
  const utcMs = Date.UTC(yyyy, mm - 1, dd, HH, MM) - tzOffsetMinutes * 60 * 1000;
  return Number.isFinite(utcMs) ? utcMs : null;
}

function dateKeyFromNow(tzOffsetMinutes, nowMs = Date.now()) {
  const localMs = nowMs + tzOffsetMinutes * 60 * 1000;
  const d = new Date(localMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateKeyFromMs(ms, tzOffsetMinutes) {
  const localMs = ms + tzOffsetMinutes * 60 * 1000;
  const d = new Date(localMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  withCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const tzOffsetMinutes = parseTzOffsetMinutes(req.query?.tzOffsetMinutes ?? 0);
  const debug = String(req.query?.debug ?? "") === "1";

  const startedAt = Date.now();
  const nowISO = new Date().toISOString();
  const todayKey = dateKeyFromNow(tzOffsetMinutes);

  try {
    if (debug) {
      console.log("[tennis-live] debug=1 request", {
        nowISO,
        tzOffsetMinutes,
        todayKey,
        query: req.query,
      });
    }

    const raw = await fetchLiveTennis();

    const matches = Array.isArray(raw?.matches) ? raw.matches : [];
    const normalized = matches.map((m) => {
      const startMs = parseDateTimeToMs(m?.date, m?.time, tzOffsetMinutes);
      const startKey = startMs ? dateKeyFromMs(startMs, tzOffsetMinutes) : null;

      const statusRaw = String(m?.status ?? "");
      const isLive = statusRaw === "1" || m?.isLive === true;

      return {
        ...m,
        isLive,
        startMs,
        startKey,
      };
    });

    const live = normalized.filter((m) => m.isLive === true);
    const today = normalized.filter((m) => m.startKey === todayKey);
    const next24h = normalized.filter((m) => {
      if (!Number.isFinite(m.startMs)) return false;
      return m.startMs >= Date.now() && m.startMs <= Date.now() + 24 * 60 * 60 * 1000;
    });

    const mode = live.length ? "LIVE" : today.length ? "TODAY" : next24h.length ? "NEXT_24H" : "LIVE";
    const out = mode === "LIVE" ? live : mode === "TODAY" ? today : next24h;

    if (debug) {
      console.log("[tennis-live] upstream + counts", {
        upstreamMatches: matches.length,
        normalized: normalized.length,
        live: live.length,
        today: today.length,
        next24h: next24h.length,
        mode,
        durationMs: Date.now() - startedAt,
      });
      if (!matches.length) {
        console.log("[tennis-live] WARNING: upstream returned 0 matches");
      }
    }

    return res.status(200).json({
      ok: true,
      mode,
      matches: out,
      meta: {
        now: nowISO,
        tzOffsetMinutes,
        todayKey,
        counts: {
          live: live.length,
          today: today.length,
          next24h: next24h.length,
          total: normalized.length,
        },
        ...(debug
          ? {
              debug: {
                upstreamMatches: matches.length,
                durationMs: Date.now() - startedAt,
              },
            }
          : {}),
      },
    });
  } catch (err) {
    console.error("[tennis-live] ERROR", err);
    return res.status(200).json({
      ok: false,
      mode: "LIVE",
      matches: [],
      meta: {
        now: nowISO,
        tzOffsetMinutes,
        todayKey,
        error: String(err?.message || err),
      },
    });
  }
}