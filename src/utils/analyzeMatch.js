// src/utils/analyzeMatch.js
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(x) ? x : 0));
const nz = (v, d = 0) => (v == null || Number.isNaN(v) ? d : v);
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function parseSetNum(status) {
  if (!status || typeof status !== 'string') return 0;
  const m = status.match(/Set\s*(\d+)/i);
  return m ? parseInt(m[1], 10) || 0 : 0;
}

function isLive(status) {
  if (!status || typeof status !== 'string') return false;
  const s = status.toLowerCase();
  if (s.includes('finished')) return false;
  if (s.includes('not started')) return false;
  if (s.includes('cancelled') || s.includes('postponed')) return false;
  return s.includes('set') || s.includes('in play') || s.includes('live') || s.includes('1st') || s.includes('2nd');
}

function getOddsPair(m) {
  const o = m?.odds || {};
  const a = nz(o.home ?? o.p1 ?? o.player1 ?? m?.p1Odds ?? m?.player1Odds, NaN);
  const b = nz(o.away ?? o.p2 ?? o.player2 ?? m?.p2Odds ?? m?.player2Odds, NaN);
  if (Number.isFinite(a) && Number.isFinite(b)) return { p1: a, p2: b };
  if (Array.isArray(o?.decimal) && o.decimal.length >= 2) return { p1: nz(o.decimal[0], NaN), p2: nz(o.decimal[1], NaN) };
  return { p1: NaN, p2: NaN };
}

function impliedFromOdds(odds) {
  return Number.isFinite(odds) && odds > 1 ? 1 / odds : NaN;
}

function favoriteIndex(oddsPair) {
  const { p1, p2 } = oddsPair;
  if (!Number.isFinite(p1) || !Number.isFinite(p2)) return 0;
  if (p1 === p2) return 0;
  return p1 < p2 ? 0 : 1;
}

function playersFromMatch(m) {
  if (Array.isArray(m?.players) && m.players.length >= 2) {
    return [m.players[0]?.name || '', m.players[1]?.name || ''];
  }
  if (typeof m?.name === 'string' && m.name.includes(' vs ')) {
    const [a, b] = m.name.split(' vs ');
    return [a?.trim() || '', b?.trim() || ''];
  }
  const a = m?.player1 || m?.p1 || '';
  const b = m?.player2 || m?.p2 || '';
  return [String(a), String(b)];
}

function numberFeature(x, lo, hi) {
  if (!Number.isFinite(x)) return 0;
  if (hi === lo) return 0;
  const t = (x - lo) / (hi - lo);
  return clamp(t, 0, 1);
}

export default function analyzeMatch(m = {}) {
  const status = m?.status || '';
  const live = isLive(status);
  const setNum = parseSetNum(status);

  const oddsPair = getOddsPair(m);
  const favIdx = favoriteIndex(oddsPair);
  const [p1Name, p2Name] = playersFromMatch(m);

  const p1Imp = impliedFromOdds(oddsPair.p1);
  const p2Imp = impliedFromOdds(oddsPair.p2);
  const favImp = favIdx === 0 ? p1Imp : p2Imp;
  const dogImp = favIdx === 0 ? p2Imp : p1Imp;

  const baseProb = Number.isFinite(favImp) ? favImp : NaN;
  const oddsEdge = Number.isFinite(favImp) && Number.isFinite(dogImp) ? favImp - dogImp : NaN;
  const x_odds = numberFeature(nz(baseProb, 0.5), 0.48, 0.75);
  const x_edge = numberFeature(nz(oddsEdge, 0), 0.00, 0.30);

  const drift = nz(m?.drift ?? m?.oddsDrift ?? m?.marketDrift, 0); // + = προς τα πάνω (χειροτερεύει), - = πέφτει (βελτιώνεται)
  const x_drift = numberFeature(-drift, -0.10, 0.10);

  const momentum = nz(m?.momentum ?? m?.formMomentum ?? m?.last5Momentum, 0); // -1..+1
  const x_momentum = clamp((momentum + 1) / 2);

  const x_set = numberFeature(setNum, 0, 3);
  const x_live = live ? 1 : 0;

  const w = { odds: 1.35, edge: 0.70, drift: 0.45, momentum: 0.40, set: 0.25, live: 0.10 };
  const z =
    w.odds * x_odds +
    w.edge * x_edge +
    w.drift * x_drift +
    w.momentum * x_momentum +
    w.set * x_set +
    w.live * x_live - 1.20;

  const conf = clamp(sigmoid(z), 0, 1);

  let label = 'AVOID';
  if (conf >= 0.86) label = 'SAFE';
  else if (conf >= 0.68) label = 'RISKY';

  const favName = favIdx === 0 ? p1Name : p2Name;
  const tip =
    label !== 'AVOID' && favName
      ? `${favName} to win match`
      : '';

  const kellyLevel = conf >= 0.86 ? 'HIGH' : conf >= 0.72 ? 'MED' : 'LOW';

  if (String(process?.env?.REACT_APP_LOG_PREDICTIONS || '') === '1') {
    try {
      // eslint-disable-next-line no-console
      console.debug('[ai:analyze]', {
        name: m?.name || `${p1Name} vs ${p2Name}`,
        status,
        label,
        conf: Number(conf.toFixed(3)),
        fav: favName,
        feats: {
          x_odds: Number(x_odds.toFixed(3)),
          x_edge: Number(x_edge.toFixed(3)),
          x_drift: Number(x_drift.toFixed(3)),
          x_momentum: Number(x_momentum.toFixed(3)),
          x_set,
          x_live,
        },
      });
    } catch {}
  }

  return {
    label,
    conf,
    kellyLevel,
    tip,
    features: {
      pOdds: nz(baseProb, 0),
      momentum: nz(momentum, 0),
      drift: nz(drift, 0),
      setNum,
      live: live ? 1 : 0,
    },
  };
}