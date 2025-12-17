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

function normalizeMatch(m, tzOffsetMinutes, now) {
  const statusRaw = String(m?.status ?? '').trim();
  const live = isLiveMatch(m);

  const dt = parseDateTime(m, tzOffsetMinutes);
  const startTimeISO = dt ? dt.toISOString() : null;

  // Critical normalization:
  // If live, never leave status as "1" because many UIs interpret that as "SET 1".
  const status = live ? 'LIVE' : (statusRaw || '0');

  const diffMs = dt ? (dt.getTime() - now.getTime()) : null;
  const diffH = Number.isFinite(diffMs) ? (diffMs / 3600000) : null;

  return {
    ...m,
    status,              // normalized
    statusRaw,           // original
    isLive: live,        // explicit boolean
    startTimeISO,        // explicit ISO
    startInHours: diffH  // useful for UI/debug
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
        error: String(e?.message || e || 'fetchLiveTennis failed')
      }
    });
  }

  const allMatchesRaw = Array.isArray(raw?.matches) ? raw.matches : [];
  const allMatches = allMatchesRaw.map((m) => normalizeMatch(m, tzOffsetMinutes, now));

  const live = [];
  const today = [];
  const next24h = [];

  for (const m of allMatches) {
    if (m.isLive) {
      live.push(m);
      continue;
    }

    if (!m.startTimeISO) continue;
    const dt = new Date(m.startTimeISO);
    if (!Number.isFinite(dt.getTime())) continue;

    const diffMs = dt.getTime() - now.getTime();
    const diffH = diffMs / 3600000;

    if (dt.toISOString().slice(0, 10) === todayKey) {
      today.push(m);
    } else if (diffH > 0 && diffH <= 24) {
      next24h.push(m);
    }
  }

  // Optional: stable ordering for upcoming buckets (soonest first)
  today.sort((a, b) => String(a.startTimeISO || '').localeCompare(String(b.startTimeISO || '')));
  next24h.sort((a, b) => String(a.startTimeISO || '').localeCompare(String(b.startTimeISO || '')));

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
        total: allMatches.length
      }
    }
  });
}