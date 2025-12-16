function normStr(x) {
  return (x ?? '').toString().trim();
}

function clampInt(n, d = 0) {
  const v = Number.parseInt(n, 10);
  return Number.isFinite(v) ? v : d;
}

function parseGoalServeDateParts(dateStr) {
  const s = normStr(dateStr);
  if (!s) return null;

  const parts = s.includes('.') ? s.split('.') : s.split('/');
  if (parts.length !== 3) return null;

  const dd = clampInt(parts[0]);
  const mm = clampInt(parts[1]);
  const yyyy = clampInt(parts[2]);
  if (!dd || !mm || !yyyy) return null;

  return { y: yyyy, m: mm, d: dd };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dayKeyFromParts(p) {
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

function dayKeyFromNowWithOffset(now, offsetMinutes) {
  const shifted = new Date(now.getTime() + offsetMinutes * 60000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

function dayDiffFromKeys(aKey, bKey) {
  const [ay, am, ad] = aKey.split('-').map((x) => clampInt(x));
  const [by, bm, bd] = bKey.split('-').map((x) => clampInt(x));
  if (!ay || !am || !ad || !by || !bm || !bd) return null;

  const a = Date.UTC(ay, am - 1, ad, 0, 0, 0, 0);
  const b = Date.UTC(by, bm - 1, bd, 0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}

function inferStatusBucket(m) {
  const st = normStr(m?.status).toLowerCase();
  if (!st) return 'unknown';

  if (st.includes('live') || st.includes('inprogress') || st.includes('in progress') || st === '2') return 'live';
  if (st.includes('finish') || st.includes('ended') || st === '3') return 'finished';
  if (st.includes('not') || st.includes('sched') || st.includes('upcoming') || st === '1' || st === '0') return 'scheduled';

  return 'unknown';
}

function withComputed(m) {
  const p = parseGoalServeDateParts(m?.date);
  const key = p ? dayKeyFromParts(p) : null;
  return {
    ...m,
    __dayKey: key,
    __bucket: inferStatusBucket(m),
  };
}

function pickDeterministicMatches(matches, now, tzOffsetMinutes, minToday) {
  const todayKey = dayKeyFromNowWithOffset(now, tzOffsetMinutes);

  const enriched = (Array.isArray(matches) ? matches : []).map(withComputed);

  const live = [];
  const today = [];
  const next24h = [];

  for (const m of enriched) {
    const bucket = m.__bucket;

    if (bucket === 'live') {
      live.push(m);
      continue;
    }

    const k = m.__dayKey;
    if (!k) continue;

    const dayDiff = dayDiffFromKeys(k, todayKey);
    if (dayDiff === 0) today.push(m);
    if (dayDiff === 0 || dayDiff === 1) next24h.push(m);
  }

  if (live.length > 0) return { chosen: [...live, ...today], mode: 'LIVE+TODAY' };

  if (today.length >= minToday) return { chosen: [...today], mode: 'TODAY' };

  if (next24h.length > 0) return { chosen: [...next24h], mode: 'NEXT_24H' };

  return { chosen: enriched, mode: 'RAW_FALLBACK' };
}

async function tryFetchViaLocalLib() {
  try {
    const mod = await import('./_lib/goalServeLiveAPI.js');

    const fn =
      mod?.fetchLiveTennis ||
      mod?.fetchLiveTennisMatches ||
      mod?.getLiveTennis ||
      mod?.default;

    if (typeof fn !== 'function') return null;

    const out = await fn({ debug: false });
    if (Array.isArray(out)) return out;
    if (out && Array.isArray(out.matches)) return out.matches;

    return null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const debug = normStr(req?.query?.debug) === '1';
  const tzOffsetMinutes = Number.isFinite(Number(req?.query?.tzOffsetMinutes))
    ? Number(req.query.tzOffsetMinutes)
    : 120;

  const minToday = Number.isFinite(Number(req?.query?.minToday))
    ? Math.max(0, Number(req.query.minToday))
    : 4;

  try {
    const matches = await tryFetchViaLocalLib();

    if (!matches) {
      const errMsg = 'tennis-live: upstream fetch unavailable';
      if (debug) {
        return res.status(500).json({ ok: false, error: errMsg, matches: [], meta: { debug: true } });
      }
      return res.status(500).json({ matches: [] });
    }

    const now = new Date();
    const { chosen, mode } = pickDeterministicMatches(matches, now, tzOffsetMinutes, minToday);

    if (debug) {
      const all = (Array.isArray(matches) ? matches : []).map(withComputed);
      const todayKey = dayKeyFromNowWithOffset(now, tzOffsetMinutes);

      const counts = all.reduce(
        (acc, m) => {
          acc.total += 1;
          acc[m.__bucket] = (acc[m.__bucket] || 0) + 1;

          const k = m.__dayKey;
          if (k) {
            const dd = dayDiffFromKeys(k, todayKey);
            if (dd === 0) acc.today += 1;
            else if (dd === 1) acc.tomorrow += 1;
            else if (dd !== null && dd < 0) acc.past += 1;
            else if (dd !== null && dd > 1) acc.future += 1;
          } else {
            acc.noDate += 1;
          }
          return acc;
        },
        { total: 0, live: 0, scheduled: 0, finished: 0, unknown: 0, today: 0, tomorrow: 0, past: 0, future: 0, noDate: 0 }
      );

      return res.status(200).json({
        ok: true,
        mode,
        matches: chosen.map((m) => {
          const { __dayKey, __bucket, ...rest } = m;
          return rest;
        }),
        meta: {
          now: now.toISOString(),
          tzOffsetMinutes,
          todayKey,
          determinismMode: mode,
          minToday,
          counts,
        },
      });
    }

    return res.status(200).json({
      matches: chosen.map((m) => {
        const { __dayKey, __bucket, ...rest } = m;
        return rest;
      }),
    });
  } catch (e) {
    if (debug) {
      return res.status(500).json({ ok: false, error: String(e?.message || e), matches: [] });
    }
    return res.status(500).json({ matches: [] });
  }
}