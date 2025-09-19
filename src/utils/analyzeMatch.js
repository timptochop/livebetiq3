// src/utils/analyzeMatch.js
//
// v1.6 (Phase 4): Momentum/Surface tuning + A/B profiles + cleaner gating
// Returns: { label, tip, kellyLevel, pick, reason, variant }
// - label: "SAFE" | "RISKY" | "AVOID" | null (UI will render SET/SOON if null)
// - tip: player name suggestion for bet (shown only for SAFE/RISKY)
// - kellyLevel: "LOW" | "MED" | "HIGH" (dot indicator in UI)
// - pick: same as tip (explicit)
// - reason: compact debug string (kept minimal; UI not showing it)
// - variant: which A/B profile was used ("vA" | "vB")
//
// A/B selection:
//   - URL param ?ab=vA or ?ab=vB
//   - or localStorage "lbq_ab_variant" = "vA"/"vB"
//   - default: "vA"
//
// Gating: we only produce predictions >= mid 3rd set.
// If gating not satisfied -> returns { label: null, tip: null, ... } and UI shows "SET x" or "SOON".

export default function analyzeMatch(match = {}) {
  const players = Array.isArray(match.players)
    ? match.players
    : (Array.isArray(match.player) ? match.player : []);
  const p1 = players[0] || {};
  const p2 = players[1] || {};

  const setNum = currentSetFromScores(players) ?? setFromStatus(match.status) ?? 0;
  const surface = parseSurface(match.categoryName || match.category || match.surface || '');

  // ---- A/B profile selection ----
  const variant = getABVariant();
  const P = PROFILES[variant] || PROFILES.vA;

  // ---- gating: mid-3rd set or later ----
  if (!isAfterMidThirdSet(players, setNum, match, P.midThirdGate)) {
    return {
      label: null, tip: null, pick: null, kellyLevel: null,
      reason: 'pre-mid-3rd', variant
    };
  }

  // ---- sets & current score ----
  const sA = [n(p1.s1), n(p1.s2), n(p1.s3), n(p1.s4), n(p1.s5)];
  const sB = [n(p2.s1), n(p2.s2), n(p2.s3), n(p2.s4), n(p2.s5)];
  const lastIdx = lastPlayedSetIndex(sA, sB); // 0-based
  const curA = sA[lastIdx] ?? 0;
  const curB = sB[lastIdx] ?? 0;
  const curLead = curA - curB;
  const curTotal = curA + curB;

  // ---- point-level & serve ----
  const { vA, vB } = currentPointValues(p1.game_score, p2.game_score);
  const serveA = asBool(p1.serve), serveB = asBool(p2.serve);
  const pointLead = pointDiffToUnit(vA, vB); // [-1..+1]
  const serveBias = (serveA ? P.serveBias : 0) - (serveB ? P.serveBias : 0);

  // ---- break-point awareness (delta for A) ----
  const bpDeltaA = breakDeltaForA(serveA, serveB, vA, vB, P.breakWeights);

  // ---- momentum (vs previous set) ----
  const prevIdx = lastIdx > 0 ? lastIdx - 1 : -1;
  const prevLead = prevIdx >= 0 ? ((sA[prevIdx] ?? 0) - (sB[prevIdx] ?? 0)) : 0;
  const deltaLead = curLead - prevLead;

  // ---- surface adjust ----
  const surfAdj = surfaceWeight(surface, P.surface);

  // ---- total momentum for A ----
  let momentumA =
    curLead * P.weights.curLead +
    deltaLead * P.weights.deltaLead +
    pointLead * P.weights.pointLead +
    serveBias +
    bpDeltaA;

  momentumA = clamp(momentumA * surfAdj.momentumScale, -6, 6);

  // ---- confidence ----
  const totalGames = sum(sA) + sum(sB);
  let conf = baseConfidence(totalGames, P.confBase);
  conf += curTotal >= 8 ? 0.02 : (curTotal >= 6 ? 0.01 : 0);
  conf = clamp(conf * surfAdj.confScale, 0.50, 0.85);

  // ---- EV proxy ----
  const absLead = Math.abs(curLead);
  let ev = absLead >= 2 ? P.evTable.byLead2
          : absLead === 1 ? P.evTable.byLead1
          : P.evTable.byLead0;

  if (momentumA > 0.8 && curTotal >= 6) ev += P.evTable.momentumBonus;
  ev += surfAdj.evBonus;

  // ---- first label ----
  let label = 'AVOID';
  if (ev > P.thresholds.safe.ev && conf > P.thresholds.safe.conf && momentumA >= P.thresholds.safe.momentum) {
    label = 'SAFE';
  } else if (ev > P.thresholds.risky.ev && conf >= P.thresholds.risky.conf) {
    label = 'RISKY';
  }

  // ---- pick ----
  const leadAgg = (sum(sA) - sum(sB)) + momentumA; // global + momentum
  const pick = leadAgg >= 0
    ? (p1.name || p1['@name'] || 'Player 1')
    : (p2.name || p2['@name'] || 'Player 2');

  // ---- Kelly guard (optional downgrade when odds present) ----
  label = kellyGuard(label, pick, conf, match, P.kelly);

  // ---- kelly level (dot indicator), coarse from conf/ev when odds missing ----
  const kellyLevel = classifyKellyLevel(conf, ev);

  const reason = `v=${variant}, set=${setNum}, lead=${curLead}, games=${curTotal}, m=${round(momentumA,2)}, surf=${surface||'n/a'}`;
  return { label, tip: pick, kellyLevel, pick, reason, variant };
}

/* =================== A/B profiles =================== */
const PROFILES = {
  vA: {
    // gating: either >=4 games into set3 OR status shows Game >=5
    midThirdGate: { minGamesInSet: 4, minGameToken: 5 },

    serveBias: 0.22,
    breakWeights: { base: 0.60, doubleBonus: 0.20 },

    weights: {
      curLead: 0.90,
      deltaLead: 0.55,
      pointLead: 0.35,
    },

    surface: {
      hardIndoor: { momentumScale: 1.05, confScale: 1.03, evBonus: 0.0010 },
      hard:       { momentumScale: 1.02, confScale: 1.01, evBonus: 0.0005 },
      grass:      { momentumScale: 0.98, confScale: 0.99, evBonus: 0.0000 },
      clay:       { momentumScale: 0.96, confScale: 0.98, evBonus: -0.0010 },
      default:    { momentumScale: 1.00, confScale: 1.00, evBonus: 0.0000 },
    },

    confBase: { // games across all sets
      gt40: 0.70,
      gt32: 0.65,
      gt24: 0.60,
      gt18: 0.57,
      else: 0.55,
    },

    evTable: {
      byLead2: 0.024,
      byLead1: 0.022,
      byLead0: 0.019,
      momentumBonus: 0.002,
    },

    thresholds: {
      safe:  { ev: 0.024, conf: 0.60, momentum: 0 },
      risky: { ev: 0.020, conf: 0.56 },
    },

    kelly: {
      minKellyForSafe: 0.01, // if < 0 -> downgrade; if < 0.01 & label SAFE -> RISKY
    },
  },

  vB: {
    // slightly more momentum-heavy and surface-sensitive
    midThirdGate: { minGamesInSet: 4, minGameToken: 5 },

    serveBias: 0.20,
    breakWeights: { base: 0.65, doubleBonus: 0.22 },

    weights: {
      curLead: 0.85,
      deltaLead: 0.65,
      pointLead: 0.40,
    },

    surface: {
      hardIndoor: { momentumScale: 1.06, confScale: 1.03, evBonus: 0.0012 },
      hard:       { momentumScale: 1.03, confScale: 1.01, evBonus: 0.0007 },
      grass:      { momentumScale: 0.97, confScale: 0.99, evBonus: 0.0000 },
      clay:       { momentumScale: 0.95, confScale: 0.98, evBonus: -0.0012 },
      default:    { momentumScale: 1.00, confScale: 1.00, evBonus: 0.0000 },
    },

    confBase: {
      gt40: 0.71,
      gt32: 0.66,
      gt24: 0.61,
      gt18: 0.58,
      else: 0.55,
    },

    evTable: {
      byLead2: 0.024,
      byLead1: 0.0225,
      byLead0: 0.019,
      momentumBonus: 0.0025,
    },

    thresholds: {
      safe:  { ev: 0.024, conf: 0.60, momentum: -0.1 },
      risky: { ev: 0.020, conf: 0.56 },
    },

    kelly: {
      minKellyForSafe: 0.01,
    },
  },
};

/* =================== helpers =================== */
function getABVariant() {
  // URL param has priority
  try {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get('ab');
    if (v === 'vA' || v === 'vB') {
      try { localStorage.setItem('lbq_ab_variant', v); } catch {}
      return v;
    }
  } catch {}
  // localStorage fallback
  try {
    const v = localStorage.getItem('lbq_ab_variant');
    if (v === 'vA' || v === 'vB') return v;
  } catch {}
  return 'vA';
}

function n(v) {
  if (v === null || v === undefined) return null;
  const x = parseInt(String(v).split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}
function sum(arr) { return (arr || []).reduce((a, b) => a + (b || 0), 0); }
function clamp(x, min, max) { return Math.max(min, Math.min(max, x)); }
function round(x, d = 2) { const k = Math.pow(10, d); return Math.round(x * k) / k; }
function asBool(x) { const s = String(x || '').toLowerCase(); return s === 'true' || s === '1' || s === 'yes'; }

function lastPlayedSetIndex(sA, sB) {
  for (let i = 4; i >= 0; i--) if (sA[i] !== null || sB[i] !== null) return i;
  return -1;
}

function setFromStatus(status) {
  const s = String(status || '').toLowerCase();
  const m = s.match(/(?:^|\s)([1-5])(?:st|nd|rd|th)?\s*set|set\s*([1-5])/i);
  if (!m) return null;
  return parseInt(m[1] || m[2], 10);
}

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [n(a.s1), n(a.s2), n(a.s3), n(a.s4), n(a.s5)];
  const sB = [n(b.s1), n(b.s2), n(b.s3), n(b.s4), n(b.s5)];
  let k = 0; for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || null;
}

function parseSurface(s) {
  const x = String(s || '').toLowerCase();
  if (x.includes('clay')) return 'clay';
  if (x.includes('grass')) return 'grass';
  if (x.includes('hard') && x.includes('indoor')) return 'hardIndoor';
  if (x.includes('hard')) return 'hard';
  return null;
}

function surfaceWeight(surface, table) {
  if (!surface) return table.default;
  return table[surface] || table.default;
}

function currentPointValues(gsA, gsB) {
  const aTok = normalizePointToken(gsA);
  const bTok = normalizePointToken(gsB);
  return { vA: pointTokenValue(aTok), vB: pointTokenValue(bTok) };
}
function normalizePointToken(s) {
  if (!s) return null;
  const str = String(s).replace(/\s+/g, '').toUpperCase(); // "15:30" / "40-AD"
  const parts = str.split(/[:\-]/);
  return parts[0] || null;
}
function pointTokenValue(tok) {
  if (!tok) return null;
  if (tok === 'AD' || tok === 'A') return 4;
  if (tok === '40') return 3;
  if (tok === '30') return 2;
  if (tok === '15') return 1;
  if (tok === '0' || tok === '00') return 0;
  return null;
}
function pointDiffToUnit(vA, vB) {
  if (vA == null || vB == null) return 0;
  return clamp((vA - vB) / 3.0, -1, 1);
}

function breakDeltaForA(serveA, serveB, vA, vB, W) {
  if (vA == null || vB == null) return 0;
  const isBreakForB_whenAserve = (vB === 3 && vA <= 2) || (vB === 4 && vA === 3);
  const isBreakForA_whenBserve = (vA === 3 && vB <= 2) || (vA === 4 && vB === 3);

  let delta = 0;
  if (serveA && isBreakForB_whenAserve) delta -= W.base;
  if (serveB && isBreakForA_whenBserve) delta += W.base;

  // double break points (0-40)
  if (serveA && vB === 3 && vA === 0) delta -= W.doubleBonus;
  if (serveB && vA === 3 && vB === 0) delta += W.doubleBonus;

  return delta;
}

function baseConfidence(totalGames, CFG) {
  if (totalGames > 40) return CFG.gt40;
  if (totalGames > 32) return CFG.gt32;
  if (totalGames > 24) return CFG.gt24;
  if (totalGames > 18) return CFG.gt18;
  return CFG.else;
}

function kellyGuard(label, pick, conf, match, K) {
  const odds = pickOdds(pick, match?.odds);
  if (!odds) return label;

  const b = Math.max(odds - 1, 0);
  const p = clamp(conf, 0.45, 0.85);
  if (b <= 0) return label;

  const kelly = (b * p - (1 - p)) / b;
  if (kelly < 0) {
    if (label === 'SAFE') return 'RISKY';
    if (label === 'RISKY') return 'AVOID';
  } else if (kelly < K.minKellyForSafe && label === 'SAFE') {
    return 'RISKY';
  }
  return label;
}

function pickOdds(pickName, odds) {
  if (!odds) return null;
  // 1) direct name match
  for (const key of Object.keys(odds)) {
    const v = odds[key];
    if (typeof v === 'number' && nameLike(key, pickName)) return v;
  }
  // 2) array markets
  if (Array.isArray(odds)) {
    for (const m of odds) {
      const v1 = m?.home || m?.player1 || m?.p1;
      const v2 = m?.away || m?.player2 || m?.p2;
      const n1 = m?.homeName || m?.name1 || m?.player1Name;
      const n2 = m?.awayName || m?.name2 || m?.player2Name;
      if (v1 && nameLike(n1, pickName) && typeof v1 === 'number') return v1;
      if (v2 && nameLike(n2, pickName) && typeof v2 === 'number') return v2;
    }
  }
  // 3) common keys
  const candidates = ['home', 'away', 'player1', 'player2', 'p1', 'p2'];
  for (const k of candidates) {
    const v = odds[k];
    if (typeof v === 'number') return v;
  }
  return null;
}

function nameLike(a, b) {
  const x = String(a || '').toLowerCase().replace(/\s+/g, '').slice(0, 12);
  const y = String(b || '').toLowerCase().replace(/\s+/g, '').slice(0, 12);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

function isAfterMidThirdSet(players, setNum, match, gateCfg) {
  if (setNum < 3) return false;
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [n(a.s1), n(a.s2), n(a.s3), n(a.s4), n(a.s5)];
  const sB = [n(b.s1), n(b.s2), n(b.s3), n(b.s4), n(b.s5)];
  const idx = lastPlayedSetIndex(sA, sB);
  const curTotal = (sA[idx] ?? 0) + (sB[idx] ?? 0);

  if (curTotal >= (gateCfg?.minGamesInSet ?? 4)) return true;

  const st = String(match?.status || '').toLowerCase();
  const gm = st.match(/game\s*(\d+)/i);
  if (gm && parseInt(gm[1], 10) >= (gateCfg?.minGameToken ?? 5)) return true;

  return false;
}

function classifyKellyLevel(conf, ev) {
  // no odds → coarse level from conf/ev
  const score = ev * 100 + conf * 10;
  if (score >= 9.5) return 'HIGH';
  if (score >= 8.6) return 'MED';
  return 'LOW';
}