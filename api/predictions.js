// api/predictions.js

const LIVE_PATH = 'tennis_scores/home?json=1';

function toArray(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}

function normalizeLive(json) {
  const categories = toArray(json?.scores?.category);
  const out = [];
  for (const cat of categories) {
    const catName = cat?.['@name'] || '';
    const catId = cat?.['@id'] || '';
    for (const m of toArray(cat?.match)) {
      const players = toArray(m?.player).map(p => ({
        id: p?.['@id'] || '',
        name: p?.['@name'] || '',
        s1: p?.['@s1'] ?? null,
        s2: p?.['@s2'] ?? null,
        s3: p?.['@s3'] ?? null,
        s4: p?.['@s4'] ?? null,
        s5: p?.['@s5'] ?? null,
      }));

      out.push({
        id: m?.['@id'] || '',
        date: m?.['@date'] || '',
        time: m?.['@time'] || '',
        status: m?.['@status'] || '',
        categoryId: catId,
        categoryName: catName,
        players,
        prediction: {
          label: 'PENDING',
          pick: null,
          confidence: 0,
          source: 'fallback',
          detail: 'set1_pending',
        },
      });
    }
  }
  return out;
}

async function fetchGoalServeJSON(path) {
  const token = process.env.GOALSERVE_TOKEN || '';
  if (!token) throw new Error('missing_GOALSERVE_TOKEN');

  // Prefer feed1; Goalserve balances across subdomains.
  const base = `http://feed1.goalserve.com/getfeed/${token}/`;
  const url = `${base}${path}`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Encoding': 'gzip, deflate',
      'User-Agent': 'livebetiq/1.0',
    },
    // Disable cache to keep it live
    cache: 'no-store',
  });

  const text = await res.text();

  // If server sent XML by mistake, force error to bubble up
  if (!res.ok) {
    const err = new Error(`upstream_${res.status}`);
    err.payload = text?.slice(0, 400);
    throw err;
  }
  if (text && text.trim().startsWith('<')) {
    const err = new Error('upstream_xml_received');
    err.payload = text?.slice(0, 400);
    throw err;
  }

  return JSON.parse(text);
}

export default async function handler(req, res) {
  try {
    const live = await fetchGoalServeJSON(LIVE_PATH);
    const matches = normalizeLive(live);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ matches });
  } catch (e) {
    const code = String(e?.message || 'unknown_error');
    res.status(200).json({ matches: [], error: code });
  }
}