// api/_lib/goalServeLiveAPI.js
const BASE = 'https://www.goalserve.com/getfeed';

function toArray(x) { return !x ? [] : (Array.isArray(x) ? x : [x]); }
function normName(s = '') { return String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim(); }

function extractTwoWayOdds(book) {
  if (!book) return null;
  const tryFields = [
    o => (o.home && o.away ? [o.home, o.away] : null),
    o => (o.odds1 && o.odds2 ? [o.odds1, o.odds2] : null),
    o => (Array.isArray(o.price) && o.price.length === 2 ? [o.price[0]['@odd'], o.price[1]['@odd']] : null),
  ];
  for (const fn of tryFields) {
    const pair = fn(book) || null;
    if (pair) {
      const [a, b] = pair.map(Number);
      if (a > 1.01 && b > 1.01) return [a, b];
    }
  }
  return null;
}

function oddsToFairProbs(o1, o2) {
  const imp1 = 1 / o1, imp2 = 1 / o2;
  const sum = imp1 + imp2;
  return { p1: imp1 / sum, p2: imp2 / sum };
}

function normalizeOdds(json) {
  const map = new Map();
  const stack = [json || {}];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;

    const n1 = node.player1 || node.home || node.team1 || node.playerA || null;
    const n2 = node.player2 || node.away || node.team2 || node.playerB || null;
    const twoWay = extractTwoWayOdds(node.odds || node);

    if (n1 && n2 && twoWay) {
      const key = `${normName(n1)}|${normName(n2)}`;
      const { p1, p2 } = oddsToFairProbs(twoWay[0], twoWay[1]);
      map.set(key, { p1, p2, src: 'odds' });
    }

    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(it => stack.push(it));
      else if (typeof v === 'object') stack.push(v);
    }
  }
  return map;
}

function normalizeLive(json) {
  const categories = toArray(json?.scores?.category);
  const out = [];
  for (const cat of categories) {
    const catName = cat['@name'] || '';
    const catId = cat['@id'] || '';
    for (const m of toArray(cat.match)) {
      const players = toArray(m.player).map(p => ({
        id: p['@id'] || '',
        name: p['@name'] || ''
      }));
      out.push({
        id: m['@id'] || '',
        date: m['@date'] || '',
        time: m['@time'] || '',
        status: m['@status'] || '',
        categoryId: catId,
        categoryName: catName,
        players
      });
    }
  }
  return out;
}

async function gsGet(pathAndQuery) {
  const token = process.env.GOALSERVE_TOKEN;
  const url = `${BASE}/${token}/${pathAndQuery}`;
  const res = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`GoalServe HTTP ${res.status}`);
  return res.json();
}

export async function fetchLiveTennis() {
  const data = await gsGet('tennis_scores/home?json=1');
  const matches = normalizeLive(data);
  return { matches };
}

export async function fetchPredictions() {
  const [liveJson, oddsJson] = await Promise.all([
    gsGet('tennis_scores/home?json=1'),
    gsGet('getodds/soccer?cat=tennis_10&json=1')
  ]);

  const live = normalizeLive(liveJson);
  let oddsMap = new Map();
  try {
    oddsMap = normalizeOdds(oddsJson);
  } catch {
    oddsMap = new Map();
  }

  const enriched = live
    .filter(m => (m.players?.length === 2))
    .map(m => {
      const p1 = m.players[0]?.name || '';
      const p2 = m.players[1]?.name || '';
      const k1 = `${normName(p1)}|${normName(p2)}`;
      const k2 = `${normName(p2)}|${normName(p1)}`;

      let pred = null;
      if (oddsMap.has(k1)) {
        const { p1: a, p2: b } = oddsMap.get(k1);
        pred = { prob1: a, prob2: b, method: 'market' };
      } else if (oddsMap.has(k2)) {
        const { p1: a, p2: b } = oddsMap.get(k2);
        pred = { prob1: b, prob2: a, method: 'market' };
      } else {
        pred = { prob1: 0.5, prob2: 0.5, method: 'fallback' };
      }

      const pick = pred.prob1 >= pred.prob2 ? 0 : 1;
      const confidence = Math.round(Math.abs(pred.prob1 - pred.prob2) * 100);

      return {
        ...m,
        prediction: {
          prob1: pred.prob1,
          prob2: pred.prob2,
          pick,
          confidence,
          source: pred.method
        }
      };
    });

  return { matches: enriched };
}