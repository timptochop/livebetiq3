import { parseStringPromise } from "xml2js";
import zlib from "zlib";

export const config = {
  api: { bodyParser: false },
};

function asArr(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function pickAttr(node, key, fallback = "") {
  if (!node) return fallback;
  if (node[key] != null) return node[key];
  if (node.$ && node.$[key] != null) return node.$[key];
  return fallback;
}

function parseDDMMYYYY(dateStr) {
  const s = String(dateStr || "").trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  if (!dd || !mm || !yy) return null;
  return { yy, mm, dd };
}

function parseHHMM(timeStr) {
  const s = String(timeStr || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mi)) return null;
  return { hh, mi };
}

function toIsoLocal(yy, mm, dd, hh, mi) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${yy}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${pad(mi)}:00`;
}

function dayKeyFromLocalMs(ms) {
  const d = new Date(ms);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function isScoresPresent(players) {
  const p = asArr(players);
  const a = p[0] || {};
  const b = p[1] || {};
  const keys = ["s1", "s2", "s3", "s4", "s5", "score", "game_score", "total"];
  const has = (obj) =>
    keys.some((k) => {
      const v = pickAttr(obj, k, "");
      return String(v || "").trim() !== "";
    });
  return has(a) || has(b);
}

function isLiveToken(statusRaw) {
  const s = String(statusRaw ?? "").trim().toLowerCase();
  return s === "live" || s === "in progress" || s === "playing" || s === "started";
}

function normalizeMatch(matchNode, categoryNode) {
  const id = pickAttr(matchNode, "id", "");
  const date = pickAttr(matchNode, "date", "");
  const time = pickAttr(matchNode, "time", "");
  const status = pickAttr(matchNode, "status", "");
  const statusRaw = pickAttr(matchNode, "statusRaw", status);

  const categoryId = pickAttr(categoryNode, "id", "");
  const categoryName = pickAttr(categoryNode, "name", "");

  const players = asArr(matchNode.player || matchNode.players || []);
  const p = players.map((pl) => ({
    id: pickAttr(pl, "id", ""),
    name: pickAttr(pl, "name", ""),
    s1: pickAttr(pl, "s1", ""),
    s2: pickAttr(pl, "s2", ""),
    s3: pickAttr(pl, "s3", ""),
    s4: pickAttr(pl, "s4", ""),
    s5: pickAttr(pl, "s5", ""),
    game_score: pickAttr(pl, "game_score", ""),
    total: pickAttr(pl, "total", ""),
  }));

  let startLocalMs = null;
  const d = parseDDMMYYYY(date);
  const t = parseHHMM(time);
  if (d && t) {
    const iso = toIsoLocal(d.yy, d.mm, d.dd, t.hh, t.mi);
    const dt = new Date(iso);
    if (Number.isFinite(dt.getTime())) startLocalMs = dt.getTime();
  }

  const scoresPresent = isScoresPresent(p);
  const liveByToken = isLiveToken(statusRaw);
  const liveByNumeric = String(statusRaw).trim() === "1";

  // IMPORTANT: statusRaw === "1" is NOT trusted as live.
  const live = scoresPresent || liveByToken;

  return {
    id: id || `${date}-${time}-${categoryId}-${Math.random().toString(16).slice(2)}`,
    date,
    time,
    status,
    statusRaw: String(statusRaw),
    categoryId,
    categoryName,
    players: p,
    _scoresPresent: scoresPresent,
    _liveByToken: liveByToken,
    _liveByNumeric: liveByNumeric,
    _live: live,
    _startLocalMs: startLocalMs,
    _dayKeyLocal: startLocalMs ? dayKeyFromLocalMs(startLocalMs) : null,
  };
}

function pickMode(matches, nowLocalMs) {
  const todayKey = dayKeyFromLocalMs(nowLocalMs);
  const in24h = nowLocalMs + 24 * 60 * 60 * 1000;

  const live = matches.filter((m) => m._live);
  if (live.length) return { mode: "LIVE", items: live };

  const today = matches.filter((m) => m._dayKeyLocal === todayKey);
  if (today.length) return { mode: "TODAY", items: today };

  const next24 = matches.filter((m) => {
    if (!Number.isFinite(m._startLocalMs)) return false;
    return m._startLocalMs >= nowLocalMs && m._startLocalMs <= in24h;
  });
  if (next24.length) return { mode: "NEXT_24H", items: next24 };

  return { mode: matches.length ? "UPCOMING" : "EMPTY", items: matches };
}

async function fetchGoalServeXml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "livebetiq3/1.0",
      "Accept-Encoding": "gzip, deflate",
    },
  });

  const buf = Buffer.from(await res.arrayBuffer());
  const enc = (res.headers.get("content-encoding") || "").toLowerCase();

  let out = buf;
  if (enc.includes("gzip")) out = zlib.gunzipSync(buf);
  else if (enc.includes("deflate")) out = zlib.inflateSync(buf);

  const text = out.toString("utf8");
  return { ok: res.ok, status: res.status, headers: Object.fromEntries(res.headers), text };
}

export default async function handler(req, res) {
  try {
    const debug = String(req.query?.debug || "") === "1";

    const token = process.env.GOALSERVE_TOKEN || process.env.GS_TOKEN || "";
    if (!token) {
      return res.status(500).json({
        ok: false,
        error: "Missing GOALSERVE_TOKEN (or GS_TOKEN) env var on Vercel.",
      });
    }

    const url = `https://www.goalserve.com/getfeed/${token}/tennis_scores/home`;

    const nowLocalMs = Date.now();
    const raw = await fetchGoalServeXml(url);
    const firstLine = (raw.text || "").trim().slice(0, 160);

    if (!raw.ok) {
      return res.status(502).json({
        ok: false,
        error: "Upstream GoalServe not OK",
        status: raw.status,
        firstLine,
      });
    }

    const xmlObj = await parseStringPromise(raw.text, {
      explicitArray: false,
      mergeAttrs: true,
      attrkey: "$",
      charkey: "_",
      trim: true,
    });

    const scores = xmlObj?.scores || xmlObj?.score || xmlObj;
    const categories = asArr(scores?.category);

    const all = [];
    for (const cat of categories) {
      const matches = asArr(cat?.match);
      for (const m of matches) all.push(normalizeMatch(m, cat));
    }

    const picked = pickMode(all, nowLocalMs);

    const payload = {
      ok: true,
      mode: picked.mode,
      matches: picked.items.map((m) => ({
        id: m.id,
        date: m.date,
        time: m.time,
        status: m.status,
        statusRaw: m.statusRaw,
        categoryId: m.categoryId,
        categoryName: m.categoryName,
        players: m.players,
      })),
    };

    if (debug) {
      const todayKey = dayKeyFromLocalMs(nowLocalMs);
      payload.meta = {
        nowLocalMs,
        todayKey,
        totalMatches: all.length,
        counts: {
          LIVE: all.filter((x) => x._live).length,
          TODAY: all.filter((x) => x._dayKeyLocal === todayKey).length,
          NEXT_24H: all.filter(
            (x) =>
              Number.isFinite(x._startLocalMs) &&
              x._startLocalMs >= nowLocalMs &&
              x._startLocalMs <= nowLocalMs + 24 * 60 * 60 * 1000
          ).length,
          BAD_DATE: all.filter((x) => !Number.isFinite(x._startLocalMs)).length,
        },
        firstLine,
        note: "Live = scoresPresent OR strong live token. statusRaw==='1' is NOT treated as live.",
      };
      payload._sample = all.slice(0, 12);
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      message: String(e?.message || e),
    });
  }
}