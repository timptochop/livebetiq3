const https = require('https');

const ODDS_URL = 'https://www.goalserve.com/getfeed/f0ad5b615f0b4febb29408dddb0d1d39/getodds/soccer?cat=tennis_10&json=1';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function toArray(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}

function normName(s = '') {
  return String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function extractTwoWay(node) {
  const o = node || {};
  if (o.home && o.away) {
    const a = Number(o.home);
    const b = Number(o.away);
    if (a > 1.01 && b > 1.01) return [a, b];
  }
  if (o.odds1 && o.odds2) {
    const a = Number(o.odds1);
    const b = Number(o.odds2);
    if (a > 1.01 && b > 1.01) return [a, b];
  }
  if (Array.isArray(o.price) && o.price.length === 2) {
    const a = Number(o.price[0]['@odd']);
    const b = Number(o.price[1]['@odd']);
    if (a > 1.01 && b > 1.01) return [a, b];
  }
  return null;
}

function impliedFromOdds(o1, o2) {
  const i1 = 1 / o1;
  const i2 = 1 / o2;
  const s = i1 + i2;
  if (s <= 0) return null;
  return { imp1: i1 / s, imp2: i2 / s };
}

function findMatchInOddsTree(root, nameA, nameB) {
  const a = normName(nameA);
  const b = normName(nameB);
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;

    const n1 =
      node.player1 || node.home || node.team1 || node.playerA || node.name1 || node['@home'] || null;
    const n2 =
      node.player2 || node.away || node.team2 || node.playerB || node.name2 || node['@away'] || null;

    if (n1 && n2) {
      const k1 = normName(n1);
      const k2 = normName(n2);
      const direct = k1 === a && k2 === b;
      const reverse = k1 === b && k2 === a;

      const tw = extractTwoWay(node.odds || node);
      if (tw) {
        const [o1, o2] = tw;
        const imp = impliedFromOdds(o1, o2);
        if (imp) {
          if (direct) return { imp1: imp.imp1, imp2: imp.imp2, source: 'odds' };
          if (reverse) return { imp1: imp.imp2, imp2: imp.imp1, source: 'odds' };
        }
      }
    }

    for (const v of Object.values(node)) {
      if (Array.isArray(v)) for (const it of v) stack.push(it);
      else if (v && typeof v === 'object') stack.push(v);
    }
  }
  return null;
}

async function fetchPregameOddsByPlayers(playerA, playerB) {
  try {
    const raw = await httpGet(ODDS_URL);
    const json = JSON.parse(raw);
    const hit = findMatchInOddsTree(json, playerA, playerB);
    return hit || null;
  } catch {
    return null;
  }
}

function normalizeOdds(raw) {
  if (!raw) return null;
  if (typeof raw.imp1 === 'number' && typeof raw.imp2 === 'number') {
    const x = raw.imp1 + raw.imp2;
    if (x > 0) return { imp1: raw.imp1, imp2: raw.imp2, source: raw.source || 'odds' };
  }
  if (raw.home && raw.away) {
    const a = Number(raw.home);
    const b = Number(raw.away);
    if (a > 1.01 && b > 1.01) {
      const imp = impliedFromOdds(a, b);
      if (imp) return { imp1: imp.imp1, imp2: imp.imp2, source: 'odds' };
    }
  }
  if (raw.odds1 && raw.odds2) {
    const a = Number(raw.odds1);
    const b = Number(raw.odds2);
    if (a > 1.01 && b > 1.01) {
      const imp = impliedFromOdds(a, b);
      if (imp) return { imp1: imp.imp1, imp2: imp.imp2, source: 'odds' };
    }
  }
  if (Array.isArray(raw.price) && raw.price.length === 2) {
    const a = Number(raw.price[0]['@odd']);
    const b = Number(raw.price[1]['@odd']);
    if (a > 1.01 && b > 1.01) {
      const imp = impliedFromOdds(a, b);
      if (imp) return { imp1: imp.imp1, imp2: imp.imp2, source: 'odds' };
    }
  }
  return null;
}

module.exports = { fetchPregameOddsByPlayers, normalizeOdds };