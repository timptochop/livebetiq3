// /api/_lib/goalServeLiveAPI.js
// Robust GoalServe fetcher with multiple fallbacks + strict JSON guard

const READ_TIMEOUT_MS = 8000;

/** tiny helper */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** fetch with timeout + plain text body (we’ll parse ourselves) */
async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'livebetiq/1.0',
        'Connection': 'close'
      },
      cache: 'no-store',
      signal: ctl.signal
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(to);
  }
}

/** normalize GoalServe JSON -> flat matches[] */
function normalizeGoalServeJSON(json) {
  const toArr = (x) => Array.isArray(x) ? x : (x ? [x] : []);
  const categories = toArr(json?.scores?.category);
  const out = [];

  for (const cat of categories) {
    const catName = cat?.['@name'] || cat?.name || '';
    const catId   = cat?.['@id']   || cat?.id   || '';
    const matches = toArr(cat?.match);

    for (const m of matches) {
      const players = toArr(m?.player).map(p => ({
        id:   p?.['@id']   ?? p?.id   ?? '',
        name: p?.['@name'] ?? p?.name ?? '',
        s1: p?.['@s1'] ?? p?.s1 ?? null,
        s2: p?.['@s2'] ?? p?.s2 ?? null,
        s3: p?.['@s3'] ?? p?.s3 ?? null,
        s4: p?.['@s4'] ?? p?.s4 ?? null,
        s5: p?.['@s5'] ?? p?.s5 ?? null,
      }));

      out.push({
        id:        m?.['@id']     || m?.id     || '',
        date:      m?.['@date']   || m?.date   || '',
        time:      m?.['@time']   || m?.time   || '',
        status:    m?.['@status'] || m?.status || '',
        categoryId:   catId,
        categoryName: catName,
        players
      });
    }
  }
  return out;
}

/**
 * Try multiple GoalServe endpoints in order.
 * We PREFER the TOKEN-in-path variant (feed1/feed2) and only if δεν υπάρχει TOKEN,
 * δοκιμάζουμε το παλιό query ?key=…
 */
export async function fetchLiveTennisRaw() {
  const token = (process.env.GOALSERVE_TOKEN || '').trim();
  const key   = (process.env.GOALSERVE_KEY   || '').trim();

  const candidates = [];

  if (token) {
    // προτιμάμε feed1 / feed2 (διαφορετικά IPs)
    candidates.push(`http://feed1.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
    candidates.push(`http://feed2.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
    // τρίτο fallback στο www (σπάνια χρειάζεται)
    candidates.push(`http://www.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`);
  }

  if (!token && key) {
    // παλιά μορφή με key στο query
    candidates.push(`https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${encodeURIComponent(key)}`);
    candidates.push(`https://www.goalserve.com/getfeed/tennis_scores/home/?key=${encodeURIComponent(key)}`);
  }

  if (candidates.length === 0) {
    const err = new Error('missing_goalserve_credentials');
    err.meta = { need: 'Set GOALSERVE_TOKEN (recommended) or GOALSERVE_KEY in Vercel env.' };
    throw err;
  }

  const tried = [];
  let lastErr = null;

  for (const url of candidates) {
    tried.push(url);
    try {
      const { ok, status, text } = await fetchText(url);

      // GoalServe συχνά στέλνει JSON ως text — το κάνουμε parse μόνοι μας.
      if (!ok) {
        // Αν το σώμα ξεκινά με "<" είναι XML -> την απορρίπτουμε ρητά για να μη μπερδευτούμε
        const looksXML = text?.trim().startsWith('<');
        const e = new Error(`upstream_${status}${looksXML ? '_xml' : ''}`);
        e.payload = text?.slice(0, 500);
        lastErr = e;
        // μικρό backoff πριν το επόμενο host
        await sleep(300);
        continue;
      }

      if (text?.trim().startsWith('<')) {
        const e = new Error('upstream_xml_received');
        e.payload = text?.slice(0, 500);
        lastErr = e;
        await sleep(200);
        continue;
      }

      // Ok, προσπάθησε JSON parse
      const json = JSON.parse(text);
      return { json, urlOk: url, urlTried: tried };
    } catch (e) {
      lastErr = e;
      await sleep(200);
      continue;
    }
  }

  const err = new Error('all_goalserve_hosts_failed');
  err.cause = lastErr;
  err.urlTried = tried;
  throw err;
}

export async function fetchLiveTennis() {
  const { json, urlOk, urlTried } = await fetchLiveTennisRaw();
  const matches = normalizeGoalServeJSON(json);
  return { matches, meta: { urlOk, urlTried, count: matches.length } };
}