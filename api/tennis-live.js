import { fetchLiveTennis } from './_lib/goalServeLiveAPI.js';

function toInt(v, d = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

function isLiveMatch(m) {
  return String(m?.status) === '1';
}

function parseDateTime(m, tzOffsetMinutes) {
  const dateStr = String(m?.date || '').trim();
  const timeStr = String(m?.time || '00:00').trim();

  const d = dateStr.split('.');
  if (d.length !== 3) return null;

  const t = timeStr.split(':');
  const year = toInt(d[2]);
  const month = toInt(d[1]) - 1;
  const day = toInt(d[0]);
  const hour = toInt(t[0]);
  const minute = toInt(t[1]);

  if (!Number.isFinite(year) || year < 2000) return null;
  if (!Number.isFinite(month) || month < 0 || month > 11) return null;
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;

  const utc = Date.UTC(year, month, day, hour, minute);
  if (!Number.isFinite(utc)) return null;

  return new Date(utc - tzOffsetMinutes * 60000);
}

function pickScore(p, key) {
  if (!p) return null;
  const v = p[key];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function computeSetNum(m) {
  const p1 = m?.players?.[0];
  const p2 = m?.players?.[1];
  if (!p1 || !p2) return null;

  const keys = ['s5', 's4', 's3', 's2', 's1']; // check from latest to earliest
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const a = pickScore(p1, k);
    const b = pickScore(p2, k);
    if (a !== null || b !== null) {
      // keys[0] is s5 => set 5, keys[4] is s1 => set 1
      const setNum = 5 - i;
      return setNum >= 1 && setNum <= 5 ? setNum : null;
    }
  }
  return null;
}

function normalizeMatch(m) {
  const live = isLiveMatch(m);
  const setNum = live ? computeSetNum(m) : null;

  return {
    ...m,
    isLive: live,
    setNum, // <-- THIS is the canonical set indicator for the UI
    statusRaw: m?.status, // keep original for debugging
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tzOffsetMinutes = toInt(req.query.tzOffsetMinutes, 0);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  let raw;
  try {
    raw = await fetchLiveTennis();
  } catch (e) {
    return res.status(200).json({
      ok: false,
      mode: 'ERROR',
      matches: [],
      meta: {
        now: now.toISOString(),
        tzOffsetMinutes,
        todayKey,
        error: String(e?.message || e || 'fetchLiveTennis failed'),
      },
    });
  }

  const allMatchesRaw = Array.isArray(raw?.matches) ? raw.matches : [];
  const allMatches = allMatchesRaw.map(normalizeMatch);

  const live = [];
  const today = [];
  const next24h = [];

  for (const m of allMatches) {
    if (m.isLive) {
      live.push(m);
      continue;
    }

    const dt = parseDateTime(m, tzOffsetMinutes);
    if (!dt) continue;

    const diffMs = dt.getTime() - now.getTime();
    const diffH = diffMs / 3600000;

    if (dt.toISOString().slice(0, 10) === todayKey) {
      today.push(m);
    } else if (diffH > 0 && diffH <= 24) {
      next24h.push(m);
    }
  }

  let mode = 'LIVE';
  let matches = live;

  if (matches.length === 0 && today.length > 0) {
    mode = 'TODAY';
    matches = today;
  }

  if (matches.length === 0 && next24h.length > 0) {
    mode = 'NEXT_24H';
    matches = next24h;
  }

  return res.status(200).json({
    ok: true,
    mode,
    matches,
    meta: {
      now: now.toISOString(),
      tzOffsetMinutes,
      todayKey,
      counts: {
        live: live.length,
        today: today.length,
        next24h: next24h.length,
        total: allMatches.length,
      },
    },
  });
}