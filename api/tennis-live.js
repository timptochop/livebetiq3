// api/tennis-live.js
import fetchLiveTennis from "./_lib/goalServeLiveAPI.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function clampInt(n, min, max, fallback = 0) {
  const x = Number.parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

// GoalServe date often: "DD.MM.YYYY", time often: "HH:MM"
function parseGoalServeDateTimeToUtcMs(dateStr, timeStr) {
  const d = String(dateStr || "").trim();
  const t = String(timeStr || "").trim();

  const m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  let hh = 0;
  let min = 0;

  const tm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (tm) {
    hh = Number(tm[1]);
    min = Number(tm[2]);
  }

  if (
    !Number.isFinite(dd) ||
    !Number.isFinite(mm) ||
    !Number.isFinite(yyyy) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(min)
  ) {
    return null;
  }

  // Construct as UTC (so we can apply tzOffsetMinutes consistently)
  const utcMs = Date.UTC(yyyy, mm - 1, dd, hh, min, 0, 0);
  return Number.isFinite(utcMs) ? utcMs : null;
}

function makeDayKeyFromLocalMs(localMs) {
  const dt = new Date(localMs);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeMatch(raw) {
  const r = raw || {};
  const statusRaw = String(r.status ?? "").trim();
  const isLive = statusRaw === "1" || String(r.statusRaw ?? "").trim() === "1" || r.isLive === true;

  const playersArr = Array.isArray(r.players) ? r.players : [];
  const p1 = playersArr[0]?.name || r.home || r.player1 || "";
  const p2 = playersArr[1]?.name || r.away || r.player2 || "";

  const dateStr = r.date || r.matchDate || r.day || "";
  const timeStr = r.time || r.matchTime || "";

  const setNum =
    r.setNum == null ? null : Number.isFinite(Number(r.setNum)) ? Number(r.setNum) : null;

  return {
    id: r.id ?? r.matchId ?? `${p1}__${p2}__${dateStr}__${timeStr}`.replace(/\s+/g, "_"),
    date: dateStr,
    time: timeStr,
    status: statusRaw || null,
    statusRaw: String(r.statusRaw ?? statusRaw ?? "").trim() || null,
    categoryId: r.categoryId ?? null,
    categoryName: r.categoryName ?? r.tournament ?? null,
    players: playersArr.length
      ? playersArr.map((p) => ({ id: p?.id ?? null, name: p?.name ?? "" }))
      : [{ id: null, name: p1 }, { id: null, name: p2 }],
    isLive,
    setNum,
    s1: r.s1 ?? null,
    s2: r.s2 ?? null,
    s3: r.s3 ?? null,
    s4: r.s4 ?? null,
    s5: r.s5 ?? null,
  };
}

function withStartMeta(m, tzOffsetMinutes, nowUtcMs) {
  const startUtcMs = parseGoalServeDateTimeToUtcMs(m.date, m.time);
  if (!Number.isFinite(startUtcMs)) {
    return {
      ...m,
      startUtcMs: null,
      startLocalMs: null,
      startsInMs: null,
      dayKeyLocal: null,
    };
  }

  const startLocalMs = startUtcMs + tzOffsetMinutes * 60 * 1000;
  const nowLocalMs = nowUtcMs + tzOffsetMinutes * 60 * 1000;

  return {
    ...m,
    startUtcMs,
    startLocalMs,
    startsInMs: startUtcMs - nowUtcMs,
    dayKeyLocal: makeDayKeyFromLocalMs(startLocalMs),
    _nowLocalMs: nowLocalMs, // internal debug helper
  };
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const tzOffsetMinutes = clampInt(req.query.tzOffsetMinutes, -840, 840, 0);
  const debug = String(req.query.debug || "").trim() === "1";
  const nowUtcMs = Date.now();
  const nowIso = new Date(nowUtcMs).toISOString();

  let raw;
  try {
    raw = await fetchLiveTennis();
  } catch (e) {
    return res.status(200).json({
      ok: false,
      mode: "ERROR",
      matches: [],
      error: "fetchLiveTennis_failed",
      meta: { now: nowIso, tzOffsetMinutes, message: String(e?.message || e) },
    });
  }

  const rawMatches = Array.isArray(raw?.matches) ? raw.matches : Array.isArray(raw) ? raw : [];
  const normalized = rawMatches.map(normalizeMatch).map((m) => withStartMeta(m, tzOffsetMinutes, nowUtcMs));

  // Local day key for "today"
  const nowLocalMs = nowUtcMs + tzOffsetMinutes * 60 * 1000;
  const todayKey = makeDayKeyFromLocalMs(nowLocalMs);

  // Buckets
  const liveMatches = normalized.filter((m) => m.isLive === true);

  const todayMatches = normalized.filter((m) => {
    if (!m.startLocalMs) return false;
    return m.dayKeyLocal === todayKey;
  });

  const next24hMatches = normalized.filter((m) => {
    if (!m.startUtcMs) return false;
    const diff = m.startUtcMs - nowUtcMs;
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  });

  // Safety net: upcoming within 7 days (this fixes “shows nothing” when TODAY/NEXT24H are empty)
  const upcoming7dMatches = normalized.filter((m) => {
    if (!m.startUtcMs) return false;
    const diff = m.startUtcMs - nowUtcMs;
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  });

  // Mode chooser (strict priority)
  let mode = "LIVE";
  let matches = liveMatches;

  if (!matches.length) {
    mode = "TODAY";
    matches = todayMatches;
  }
  if (!matches.length) {
    mode = "NEXT_24H";
    matches = next24hMatches;
  }
  if (!matches.length) {
    mode = "UPCOMING_7D";
    matches = upcoming7dMatches;
  }
  if (!matches.length) {
    mode = "EMPTY";
    matches = [];
  }

  // Sort: live first, then soonest start
  matches = matches.slice().sort((a, b) => {
    const al = a.isLive ? 0 : 1;
    const bl = b.isLive ? 0 : 1;
    if (al !== bl) return al - bl;
    const at = Number.isFinite(a.startUtcMs) ? a.startUtcMs : Number.MAX_SAFE_INTEGER;
    const bt = Number.isFinite(b.startUtcMs) ? b.startUtcMs : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  const payload = {
    ok: true,
    mode,
    matches,
    meta: {
      now: nowIso,
      tzOffsetMinutes,
      todayKey,
      counts: {
        live: liveMatches.length,
        today: todayMatches.length,
        next24h: next24hMatches.length,
        upcoming7d: upcoming7dMatches.length,
        total: normalized.length,
      },
    },
  };

  if (debug) {
    payload.debug = {
      sample: normalized.slice(0, 3),
      note:
        "If counts.total > 0 but LIVE/TODAY/NEXT_24H are 0, UPCOMING_7D should still show future matches.",
    };
  }

  return res.status(200).json(payload);
}