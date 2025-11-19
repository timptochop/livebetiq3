function n(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const i = s.split(/[.:]/)[0];
  const x = parseInt(i, 10);
  return Number.isFinite(x) ? x : null;
}

function getPlayers(match) {
  const p = match.players || match.player || [];
  const a = Array.isArray(p) ? p[0] || {} : {};
  const b = Array.isArray(p) ? p[1] || {} : {};
  const wrap = (o) => ({
    name: o.name || o['@name'] || '',
    s: [
      n(o.s1 || o['@s1']),
      n(o.s2 || o['@s2']),
      n(o.s3 || o['@s3']),
      n(o.s4 || o['@s4']),
      n(o.s5 || o['@s5'])
    ]
  });
  return { A: wrap(a), B: wrap(b) };
}

function currentSetNum(A, B) {
  let k = 0;
  for (let i = 0; i < 5; i++) if (A.s[i] !== null || B.s[i] !== null) k = i + 1;
  return k || 1;
}

function setWins(A, B) {
  let wa = 0, wb = 0;
  for (let i = 0; i < 5; i++) {
    const av = A.s[i], bv = B.s[i];
    if (av === null || bv === null) continue;
    if (av > bv) wa++;
    else if (bv > av) wb++;
  }
  return { wa, wb };
}

function gamesTotals(A, B) {
  let ga = 0, gb = 0;
  for (let i = 0; i < 5; i++) {
    if (A.s[i] !== null) ga += A.s[i];
    if (B.s[i] !== null) gb += B.s[i];
  }
  return { ga, gb, diff: ga - gb };
}

function baselineFromOdds(m) {
  const o = m.prediction && m.prediction.odds;
  if (!o) return { pA: 0.5, pB: 0.5, source: 'fallback' };

  if (typeof o.imp1 === 'number' && typeof o.imp2 === 'number') {
    const s = o.imp1 + o.imp2;
    if (s > 0) {
      return {
        pA: o.imp1 / s,
        pB: o.imp2 / s,
        source: o.source || 'odds'
      };
    }
  }

  if (typeof o.p1 === 'number' && typeof o.p2 === 'number') {
    const s = o.p1 + o.p2;
    if (s > 0) {
      return {
        pA: o.p1 / s,
        pB: o.p2 / s,
        source: o.source || 'odds'
      };
    }
  }

  return { pA: 0.5, pB: 0.5, source: 'fallback' };
}

function clamp01(x) {
  return Math.min(0.999, Math.max(0.001, x));
}

function updateWithScore(pA0, pB0, wa, wb, ga, gb, setNum) {
  let la = Math.log(clamp01(pA0) / clamp01(1 - pA0));
  let lb = Math.log(clamp01(pB0) / clamp01(1 - pB0));

  const setEdge = (wa - wb) * 1.9;
  const gameEdge = (ga - gb) * 0.11;
  const late = Math.max(0, setNum - 2) * 0.22;

  la += setEdge + gameEdge + late;
  lb += -setEdge - gameEdge - late;

  let pA = 1 / (1 + Math.exp(-la));
  let pB = 1 / (1 + Math.exp(-lb));
  const s = pA + pB;

  if (s > 0) {
    pA /= s;
    pB /= s;
  } else {
    pA = 0.5;
    pB = 0.5;
  }

  return { pA, pB };
}

function momentumNow(A, B, setNum) {
  const i = setNum - 1;
  const a = A.s[i], b = B.s[i];
  if (a === null || b === null) return 0;
  const d = a - b;
  return Math.max(-3, Math.min(3, d));
}

function applyMomentum(pA, pB, mom) {
  if (!mom) return { pA, pB };
  const bump = Math.tanh(mom / 3) * 0.06;
  let a = pA + bump, b = pB - bump;
  a = Math.min(0.99, Math.max(0.01, a));
  b = Math.min(0.99, Math.max(0.01, b));
  const s = a + b;
  return { pA: a / s, pB: b / s };
}

// thresholds aligned with WebAPI config: thrSafe=0.61, thrRisky=0.40
function labelFromConfidence(c) {
  if (c >= 61) return 'SAFE';
  if (c >= 40) return 'RISKY';
  return 'AVOID';
}

function buildPrediction(m) {
  const { A, B } = getPlayers(m);
  const setNum = currentSetNum(A, B);
  const status = String(m.status || m['@status'] || '').toLowerCase();

  if (status === 'not started' || setNum < 3) {
    return {
      label: 'PENDING',
      pick: null,
      confidence: 0,
      source: 'fallback',
      detail: `set${setNum}_pending`
    };
  }

  const { wa, wb } = setWins(A, B);
  const { ga, gb } = gamesTotals(A, B);
  const base = baselineFromOdds(m);

  let { pA, pB } = updateWithScore(base.pA, base.pB, wa, wb, ga, gb, setNum);
  ({ pA, pB } = applyMomentum(pA, pB, momentumNow(A, B, setNum)));

  const pick = pA >= pB ? (A.name || '') : (B.name || '');
  const confidence = Math.round(Math.abs(pA - pB) * 100);
  const label = labelFromConfidence(confidence);

  return {
    label,
    pick,
    confidence,
    source: `hybrid:${base.source}`,
    probs: {
      A: Math.round(pA * 100),
      B: Math.round(pB * 100)
    },
    reason: `sets_${wa}-${wb}_games_${ga}-${gb}_set${setNum}`
  };
}

function predictMatches(matches) {
  const arr = Array.isArray(matches) ? matches : [];
  return arr.map((m) => ({
    ...m,
    prediction: buildPrediction(m)
  }));
}

module.exports = { predictMatches };