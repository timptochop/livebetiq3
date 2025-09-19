// src/utils/analyzeMatch.js
// AI v1.6 — A/B momentum & surface tuning, mid-3rd gating, break-point awareness,
// Kelly guard (downgrade if negative value). Clean outputs for UI.
//
// Returns: { label, pick, tip, kellyLevel, reason }

export default function analyzeMatch(match = {}) {
  const players = Array.isArray(match.players)
    ? match.players
    : (Array.isArray(match.player) ? match.player : []);
  const p1 = players[0] || {};
  const p2 = players[1] || {};

  // --- current set detection ---
  const setNum =
    currentSetFromScores(players) ??
    setFromStatus(match.status) ??
    0;

  // --- mid-3rd gating: only start predicting from mid of 3rd set and later
  if (!isAfterMidThirdSet(players, setNum, match)) {
    return { label: null, pick: null, tip: null, kellyLevel: null, reason: 'pre-mid-3rd' };
  }

  // --- set/game data ---
  const sA = [n(p1.s1), n(p1.s2), n(p1.s3), n(p1.s4), n(p1.s5)];
  const sB = [n(p2.s1), n(p2.s2), n(p2.s3), n(p2.s4), n(p2.s5)];
  const lastIdx = lastPlayedSetIndex(sA, sB); // 0-based index of current/last set

  const curA = sA[lastIdx] ?? 0;
  const curB = sB[lastIdx] ?? 0;
  const curLead = curA - curB;        // games lead in current set
  const curTotal = curA + curB;       // total games in current set

  // --- point-level & serve information ---
  const { vA, vB } = currentPointValues(p1.game_score, p2.game_score);
  const serveA = asBool(p1.serve);
  const serveB = asBool(p2.serve);
  const pointLead = pointDiffToUnit(vA, vB); // [-1..+1]
  const serveBias = (serveA ? 0.22 : 0) - (serveB ? 0.22 : 0);

  // --- break-point awareness (delta for A) ---
  const bpDeltaA = breakDeltaForA(serveA, serveB, vA, vB);

  // --- previous set momentum delta ---
  const prevIdx = lastIdx > 0 ? lastIdx - 1 : -1;
  const prevLead = prevIdx >= 0 ? ((sA[prevIdx] ?? 0) - (sB[prevIdx] ?? 0)) : 0;
  const deltaLead = curLead - prevLead; // how the lead changed vs previous set

  // --- surface ---
  const surface = parseSurface(
    match.categoryName || match.category || match.surface || ''
  );

  // --- A/B tuning profile from URL (?ab=vA|vB), default vA ---
  const ab = getABProfile(); // 'vA' | 'vB'
  const weights = getWeights(surface, ab);

  // --- momentum score for A ---
  let momentumA =
    curLead * weights.curLead +
    deltaLead * weights.deltaLead +
    pointLead * weights.pointLead +
    serveBias +
    bpDeltaA;

  momentumA = clamp(momentumA * weights.momentumScale, -6, 6);

  // --- confidence (depth + surface scaling) ---
  const totalGames = sum(sA) + sum(sB);
  let conf =
    totalGames > 40 ? 0.71 :
    totalGames > 32 ? 0.66 :
    totalGames > 24 ? 0.61 :
    totalGames > 18 ? 0.58 : 0.55;

  if (curTotal >= 8) conf += 0.03;
  else if (curTotal >= 6) conf += 0.02;

  conf = clamp(conf * weights.confScale, 0.50, 0.82);

  // --- EV proxy (simple lead-based, with small momentum/surface bonus) ---
  const absLead = Math.abs(curLead);
  let ev =
    absLead >= 2 ? 0.024 :
    absLead === 1 ? 0.022 : 0.019;

  if (momentumA > 0.8 && curTotal >= 6) ev += 0.002;
  ev += weights.evBonus;

  // --- primary labeling ---
  let label = 'AVOID';
  if (ev > 0.024 && conf > 0.60 && momentumA >= 0) label = 'SAFE';
  else if (ev > 0.020 && conf >= 0.56)              label = 'RISKY';

  // --- pick name ---
  const leadAgg = (sum(sA) - sum(sB)) + momentumA;
  const pick = leadAgg >= 0
    ? (p1.name || p1['@name'] || 'Player 1')
    : (p2.name || p2['@name'] || 'Player 2');

  // --- Kelly guard (if odds exist) — downgrade low/negative value
  label = kellyGuard(label, pick, conf, match);

  // --- Kelly level dots for UI (based on confidence only; no numbers in UI) ---
  const kellyLevel = conf >= 0.68 ? 'HIGH' : conf >= 0.60 ? 'MED' : 'LOW';

  const reason = `set=${setNum}, curLead=${curLead}, games=${curTotal}, m=${round(momentumA,2)}, surf=${surface||'n/a'}, ab=${ab}`;
  return {
    label,
    pick,
    tip: pick,    // UI displays "TIP: {tip}" — no EV/CONF numbers shown
    kellyLevel,
    reason
  };
}

/* ================= helpers ================= */

function n(v) { if (v === null || v === undefined) return null; const x = parseInt(String(v).split(/[.:]/)[0], 10); return Number.isFinite(x) ? x : null; }
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

/* ---------- surface ---------- */
function parseSurface(s) {
  const x = String(s || '').toLowerCase();
  if (x.includes('clay')) return 'clay';
  if (x.includes('grass')) return 'grass';
  if (x.includes('hard'))  return x.includes('indoor') ? 'hard-indoor' : 'hard';
  return null;
}

/* Weights differ per surface & AB profile */
function getWeights(surface, ab) {
  // base weights for momentum components
  const base = {
    curLead: 0.90,
    deltaLead: 0.60,
    pointLead: 0.35,
    momentumScale: 1.00,
    confScale: 1.00,
    evBonus: 0.0000
  };

  // surface tweaks
  const surf =
    surface === 'hard-indoor' ? { momentumScale: 1.05, confScale: 1.03, evBonus: +0.0010 } :
    surface === 'hard'        ? { momentumScale: 1.02, confScale: 1.01, evBonus: +0.0005 } :
    surface === 'grass'       ? { momentumScale: 0.98, confScale: 0.99, evBonus: +0.0000 } :
    surface === 'clay'        ? { momentumScale: 0.96, confScale: 0.98, evBonus: -0.0010 } :
                                { momentumScale: 1.00, confScale: 1.00, evBonus: +0.0000 };

  // A/B tuning (small deltas so behavior stays stable)
  if (ab === 'vB') {
    // Variant B: slightly more weight on pointLead (micro-momentum), slightly lower EV bonus overall
    return {
      curLead: base.curLead,
      deltaLead: base.deltaLead * 0.95,
      pointLead: base.pointLead * 1.15,
      momentumScale: surf.momentumScale * 1.01,
      confScale: surf.confScale,
      evBonus: surf.evBonus - 0.0002
    };
  }

  // Variant A (default): slightly more weight on deltaLead (set-to-set swings)
  return {
    curLead: base.curLead,
    deltaLead: base.deltaLead * 1.08,
    pointLead: base.pointLead * 0.95,
    momentumScale: surf.momentumScale,
    confScale: surf.confScale,
    evBonus: surf.evBonus
  };
}

/* ---------- point score ---------- */
function currentPointValues(gsA, gsB) {
  const aTok = normalizePointToken(gsA);
  const bTok = normalizePointToken(gsB);
  return { vA: pointTokenValue(aTok), vB: pointTokenValue(bTok) };
}
function normalizePointToken(s) {
  if (!s) return null;
  const str = String(s).replace(/\s+/g, '').toUpperCase(); // "15:30" / "40-AD" etc
  const parts = str.split(/[:\-]/);
  return parts[0] || null; // token for player
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

/* ---------- break-point awareness ---------- */
function breakDeltaForA(serveA, serveB, vA, vB) {
  if (vA == null || vB == null) return 0;

  // Simple patterns:
  //  - If A serves: BP for B when (B=40 & A<=30) or (B=AD & A=40)
  //  - If B serves: BP for A when (A=40 & B<=30) or (A=AD & B=40)
  const isBreakForB_whenAserve = (vB === 3 && vA <= 2) || (vB === 4 && vA === 3);
  const isBreakForA_whenBserve = (vA === 3 && vB <= 2) || (vA === 4 && vB === 3);

  let delta = 0;
  if (serveA && isBreakForB_whenAserve) delta -= 0.6; // against A
  if (serveB && isBreakForA_whenBserve) delta += 0.6; // for A

  // double BP (0-40) stronger signal
  if (serveA && vB === 3 && vA === 0) delta -= 0.2;
  if (serveB && vA === 3 && vB === 0) delta += 0.2;

  return delta;
}

/* ---------- Kelly guard ---------- */
function kellyGuard(label, pick, conf, match) {
  const odds = pickOdds(pick, match?.odds);
  if (!odds) return label;

  const b = Math.max(odds - 1, 0);
  const p = clamp(conf, 0.45, 0.85);
  if (b <= 0) return label;

  const k = (b * p - (1 - p)) / b; // Kelly fraction
  if (k < 0) {
    if (label === 'SAFE') return 'RISKY';
    if (label === 'RISKY') return 'AVOID';
  } else if (k < 0.01 && label === 'SAFE') {
    return 'RISKY';
  }
  return label;
}

function pickOdds(pickName, odds) {
  if (!odds) return null;

  // 1) match keys by name
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
  // 3) common keys fallback
  const candidates = ['home','away','player1','player2','p1','p2'];
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

/* ---------- mid-3rd gate helpers ---------- */
function isAfterMidThirdSet(players, setNum, match) {
  if (setNum < 3) return false;
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [n(a.s1), n(a.s2), n(a.s3), n(a.s4), n(a.s5)];
  const sB = [n(b.s1), n(b.s2), n(b.s3), n(b.s4), n(b.s5)];
  const idx = lastPlayedSetIndex(sA, sB);
  const curTotal = (sA[idx] ?? 0) + (sB[idx] ?? 0);

  if (curTotal >= 4) return true;

  const st = String(match?.status || '').toLowerCase();
  const gm = st.match(/game\s*(\d+)/i);
  if (gm && parseInt(gm[1], 10) >= 5) return true;

  return false;
}

/* ---------- AB profile from URL ---------- */
function getABProfile() {
  if (typeof window === 'undefined') return 'vA';
  try {
    const ab = new URLSearchParams(window.location.search).get('ab');
    return ab === 'vB' ? 'vB' : 'vA';
  } catch {
    return 'vA';
  }
}