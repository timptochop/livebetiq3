/* src/utils/predictor.js
   v3.3-calibrated — pointContext + volatility-aware confidence + Dynamic Kelly stake
   Single-module drop-in, no UI changes.
*/

export function currentSetFromScores(m = {}) {
  const s = (m.status || m.set || "").toString().toLowerCase();
  if (s.includes("set 3")) return 3;
  if (s.includes("set 2")) return 2;
  if (s.includes("set 1")) return 1;
  if (Number.isFinite(m.setNum)) return m.setNum;
  return 0;
}

function currentGameFromScores(players = []) {
  const a = (players && players[0]) ? players[0] : {};
  const b = (players && players[1]) ? players[1] : {};
  const gA = parseInt(a.games ?? a.g ?? a.currentGame ?? 0, 10) || 0;
  const gB = parseInt(b.games ?? b.g ?? b.currentGame ?? 0, 10) || 0;
  return { gA: gA, gB: gB, total: gA + gB, diff: Math.abs(gA - gB) };
}

function parsePointScore(raw = "") {
  const map = { "0": 0, "15": 1, "30": 2, "40": 3, "Ad": 4 };
  const parts = (raw || "").split("-");
  const pA = map[parts[0]] ?? 0;
  const pB = map[parts[1]] ?? 0;
  return [pA, pB];
}

function previousSetWinner(players = []) {
  const a = (players && players[0]) ? players[0] : {};
  const b = (players && players[1]) ? players[1] : {};
  const s1 = parseInt(a.s1 ?? 0, 10) || 0;
  const s2 = parseInt(b.s1 ?? 0, 10) || 0;
  if (s1 === s2) return 0;
  return s1 > s2 ? 1 : 2;
}

function sigmoid(z){ return 1/(1+Math.exp(-z)); }
function round2(x){ return Math.round(x*100)/100; }

function clampOdds(v){
  if (!Number.isFinite(v)) return 0.5;
  const min=1.1,max=3.0,t=Math.max(min,Math.min(max,v));
  return 1-((t-min)/(max-min));
}

function surfaceAdjust(surface = "", indoor = false) {
  const s = (surface || "").toLowerCase();
  let adj = 0;
  if (s.includes("clay")) adj -= 0.05;
  if (s.includes("grass")) adj += 0.05;
  if (indoor) adj += 0.03;
  return adj;
}

// --- v3 volatility (inlined) ---
function volatilityFromMatch(m = {}) {
  const cg = currentGameFromScores(m.players || []);
  const total = cg.total;
  const diff = cg.diff;
  let vol = 0.5;
  if (total >= 4 && total <= 10) {
    if (diff <= 1) vol = 0.8;
    else if (diff === 2) vol = 0.6;
    else vol = 0.4;
  } else if (total > 10) {
    vol = 0.3;
  }
  return round2(vol);
}

// 0.4..0.9 => 0..1
function normalizeConf(c){
  const min=0.4,max=0.9;
  if (c<=min) return 0;
  if (c>=max) return 1;
  return (c-min)/(max-min);
}

// Dynamic Kelly v3.3-calibrated — pointContext + volatility-aware confidence + Dynamic Kelly stake
function kellyDynamic(params) {
  const conf = params.conf;
  const odds = params.odds;
  const volatility = Number.isFinite(params.volatility) ? params.volatility : 0.5;

  if (!Number.isFinite(odds) || odds <= 1) return 0;
  const b = odds - 1;

  const stretch = 1 - (0.3 * volatility);         // 0.7..0.91
  const p = Math.min(0.99, Math.max(0.01, 0.5 + (conf - 0.5) * stretch));
  const q = 1 - p;

  const f0 = (b * p - q) / b;
  if (f0 <= 0) return 0;

  const ev = p * odds - 1;
  const evScale = Math.max(0, Math.min(1, ev));

  const volMul = 1 - (0.5 * (volatility - 0.3) / 0.5); // ~1.0..0.5

  const f = f0 * evScale * volMul;
  return round2(Math.max(0, Math.min(1, f)));
}

export function predictMatch(m = {}, featuresIn = {}) {
  const f = {
    pOdds: featuresIn.pOdds ?? m.pOdds ?? null,
    momentum: featuresIn.momentum ?? m.momentum ?? 0,
    drift: featuresIn.drift ?? m.drift ?? 0,
    live: featuresIn.live ?? m.live ?? false,
    setNum: featuresIn.setNum ?? currentSetFromScores(m),
    surface: m.categoryName || m.surface || "",
    indoor: /indoor/i.test(m.categoryName || m.surface || ""),
    pointScore: m.pointScore || "",
    ...featuresIn
  };

  if (!f.live) {
    const badge = f.setNum===1?"SET 1":f.setNum===2?"SET 2":f.setNum>=3?"SET 3":"START SOON";
    return decorate({ label: badge, conf: 0, tip: "", kellyStake: 0, volatility: 0.5 }, f, m);
  }
  if (f.setNum === 1) return decorate({ label:"SET 1", conf:0, tip:"", kellyStake:0, volatility:0.5 }, f, m);
  if (f.setNum >= 3)  return decorate({ label:"SET 3", conf:0, tip:"", kellyStake:0, volatility:0.5 }, f, m);

  const cg = currentGameFromScores(m.players || []);
  if (cg.total < 3) return decorate({ label:"SET 2", conf:0, tip:"", kellyStake:0, volatility:0.5 }, f, m);
  if (cg.total > 6 || (cg.gA >= 6 && cg.gB >= 6))
    return decorate({ label:"AVOID", conf:0, tip:"", kellyStake:0, volatility:0.5 }, f, m);

  const w=[1.6,0.9,1.1,0.3], b=-1.0;
  const x0=clampOdds(f.pOdds);
  const x1=Number.isFinite(f.momentum)?f.momentum:0;
  const x2=Number.isFinite(f.drift)?f.drift:0;
  let conf = sigmoid(w[0]*x0 + w[1]*x1 + w[2]*x2 + w[3] + b);

  const winner = previousSetWinner(m.players || []);
  if (winner===1) conf += 0.05; else if (winner===2) conf -= 0.05;

  if (f.drift > 0.10) conf -= 0.05;
  if (f.drift < -0.10) conf += 0.05;

  conf += surfaceAdjust(f.surface, f.indoor);

  const ps = parsePointScore(f.pointScore);
  if (ps[0] - ps[1] >= 2) conf += 0.05;
  if (ps[1] - ps[0] >= 2) conf -= 0.05;

  const volatility = volatilityFromMatch(m);
  conf = normalizeConf(conf);
  conf = round2(Math.max(0, Math.min(1, conf)));

  let label = "RISKY";
  if (conf >= 0.80) label = "SAFE";
  else if (conf < 0.65) label = "AVOID";

  const tip = makeTip(m, f);
  const kellyStake = kellyDynamic({ conf: conf, odds: f.pOdds, volatility: volatility });

  const out = decorate({ label, conf, tip, kellyStake, volatility }, f, m);

  try {
    console.table([{
      id: m.id || "-",
      players: `${(m?.players?.[0]?.name)||"?"} vs ${(m?.players?.[1]?.name)||"?"}`,
      setNum: f.setNum,
      games: `${cg.gA}-${cg.gB}`,
      pointScore: f.pointScore || "-",
      odds: f.pOdds,
      momentum: f.momentum,
      drift: f.drift,
      volatility: volatility,
      conf: conf,
      label: label,
      kellyStake: kellyStake
    }]);
  } catch(e) {}

  return out;
}

function decorate(out, features, m){
  out.features = { ...features, live: features.live ? 1 : 0, setNum: features.setNum ?? currentSetFromScores(m) };
  return out;
}

function makeTip(m={}, f={}){
  const pA = (m?.players?.[0]?.name) || m?.home?.name || firstFromName(m?.name,0) || "Player A";
  const pB = (m?.players?.[1]?.name) || m?.away?.name || firstFromName(m?.name,1) || "Player B";
  if (Number.isFinite(f.pOdds)) return f.pOdds <= 1.75 ? `TIP: ${pA} to win match` : `TIP: ${pB} to win match`;
  if ((f.momentum ?? 0) >= 0)   return `TIP: ${pA} to win match`;
  return `TIP: ${pB} to win match`;
}

function firstFromName(full, idx){
  if (!full || typeof full !== "string") return null;
  const vs = full.split(" vs ");
  if (vs.length !== 2) return null;
  return (vs[idx] || "").trim() || null;
}

export default function run(m = {}, features = {}){ return predictMatch(m, features); }
