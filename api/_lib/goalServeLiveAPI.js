// api/_lib/goalServeLiveAPI.js
const LIVE_BASE = 'https://www.goalserve.com/getfeed';
const TENNIS_LIVE = 'tennis_scores/home?json=1';
const TENNIS_ITF = 'tennis_scores/itf?json=1';
const ODDS = 'getodds/soccer?cat=tennis_10&json=1';

async function httpGet(url) {
  const c = new AbortController();
  const tid = setTimeout(() => c.abort(), 6000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'accept': 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(tid);
  }
}

function toArray(x) { return Array.isArray(x) ? x : x ? [x] : []; }
function normName(s='') { return String(s).toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').trim(); }

function normalizeLive(json) {
  const cats = toArray(json?.scores?.category);
  const out = [];
  for (const cat of cats) {
    const catName = cat['@name'] || '';
    const catId = cat['@id'] || '';
    for (const m of toArray(cat.match)) {
      const status = m['@status'] || '';
      const players = toArray(m.player).map(p => ({ id: p['@id'] || '', name: p['@name'] || '', s1: p['@s1'], s2: p['@s2'], s3: p['@s3'], s4: p['@s4'], s5: p['@s5'] }));
      out.push({ id: m['@id'] || '', date: m['@date'] || '', time: m['@time'] || '', status, categoryId: catId, categoryName: catName, players });
    }
  }
  return out;
}

function extractTwoWayPair(obj) {
  if (!obj) return null;
  if (obj.home && obj.away) return [obj.home, obj.away];
  if (obj.odds1 && obj.odds2) return [obj.odds1, obj.odds2];
  if (Array.isArray(obj.price) && obj.price.length === 2) return [obj.price[0]['@odd'], obj.price[1]['@odd']];
  return null;
}

function oddsToFair(o1, o2) {
  const a = 1/Number(o1), b = 1/Number(o2);
  const s = a + b;
  return s > 0 ? { p1: a/s, p2: b/s } : { p1: 0.5, p2: 0.5 };
}

function normalizeOdds(json) {
  const map = new Map();
  const stack = [json];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    const n1 = node.player1 || node.home || node.team1 || node.playerA;
    const n2 = node.player2 || node.away || node.team2 || node.playerB;
    const pair = extractTwoWayPair(node.odds || node);
    if (n1 && n2 && pair) {
      const key = `${normName(n1)}|${normName(n2)}`;
      const fair = oddsToFair(pair[0], pair[1]);
      map.set(key, { p1: fair.p1, p2: fair.p2 });
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(x => stack.push(x));
      else if (typeof v === 'object') stack.push(v);
    }
  }
  return map;
}

export async function fetchLiveAndPredictions() {
  const token = process.env.GOALSERVE_TOKEN;
  if (!token) throw new Error('GOALSERVE_TOKEN missing');

  const liveUrl = `${LIVE_BASE}/${token}/${TENNIS_LIVE}`;
  const itfUrl  = `${LIVE_BASE}/${token}/${TENNIS_ITF}`;
  const oddsUrl = `${LIVE_BASE}/${token}/${ODDS}`;

  const [liveTxt, itfTxt, oddsTxt] = await Promise.all([
    httpGet(liveUrl).catch(() => 'null'),
    httpGet(itfUrl).catch(() => 'null'),
    httpGet(oddsUrl).catch(() => 'null'),
  ]);

  let live = [];
  try { live = normalizeLive(JSON.parse(liveTxt)); } catch {}
  try { live = live.concat(normalizeLive(JSON.parse(itfTxt))); } catch {}

  let oddsMap = new Map();
  try { oddsMap = normalizeOdds(JSON.parse(oddsTxt)); } catch {}

  const matches = live.filter(m => Array.isArray(m.players) && m.players.length === 2).map(m => {
    const p1 = m.players[0]?.name || '';
    const p2 = m.players[1]?.name || '';
    const k1 = `${normName(p1)}|${normName(p2)}`;
    const k2 = `${normName(p2)}|${normName(p1)}`;
    let prob1 = 0.5, prob2 = 0.5, source = 'fallback';
    if (oddsMap.has(k1)) { const o = oddsMap.get(k1); prob1 = o.p1; prob2 = o.p2; source = 'odds'; }
    else if (oddsMap.has(k2)) { const o = oddsMap.get(k2); prob1 = o.p2; prob2 = o.p1; source = 'odds'; }
    const pick = prob1 >= prob2 ? 0 : 1;
    const confidence = Math.round(Math.abs(prob1 - prob2) * 100);
    return { ...m, prediction: { prob1, prob2, pick, confidence, label: 'PENDING', source } };
  });

  return { matches };
}