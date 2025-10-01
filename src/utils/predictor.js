// Lightweight, robust predictor with safe fallbacks
// Returns: { label: "SAFE"|"RISKY"|"AVOID"|"PENDING", conf, kellyLevel, tip }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
const toNum = (v) => (v === null || v === undefined ? null : Number(v));

function readDecimalOdds(p = {}) {
  // Try common fields
  const candidates = [
    p.oddsDecimal, p.decimal, p.odds, p.price, p.o, p["@odds"], p["@price"]
  ].map(toNum).filter(x => Number.isFinite(x));

  let x = candidates.find(v => v > 1.01 && v < 100);
  if (x) return x;

  // Try American odds
  const am = [p.american, p["@american"]].map(toNum).find(Number.isFinite);
  if (Number.isFinite(am)) {
    if (am > 0) return 1 + (am / 100);
    if (am < 0) return 1 + (100 / Math.abs(am));
  }
  return null;
}

function impliedProb(decOdds) {
  if (!Number.isFinite(decOdds) || decOdds <= 1) return null;
  return 1 / decOdds;
}

function setNumberFromPlayers(players = []) {
  const g = n => (n === null || n === undefined ? null : parseInt(String(n).split(/[.:]/)[0], 10));
  const a = players[0] || {}, b = players[1] || {};
  const sA = [g(a.s1), g(a.s2), g(a.s3), g(a.s4), g(a.s5)];
  const sB = [g(b.s1), g(b.s2), g(b.s3), g(b.s4), g(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || 0;
}

export default function predictMatch(m = {}) {
  const players = Array.isArray(m.players) ? m.players
                 : Array.isArray(m.player)  ? m.player  : [];
  const p1 = players[0] || {};
  const p2 = players[1] || {};
  const name1 = p1.name || p1["@name"] || "";
  const name2 = p2.name || p2["@name"] || "";

  const d1 = readDecimalOdds(p1);
  const d2 = readDecimalOdds(p2);
  const q1 = impliedProb(d1);
  const q2 = impliedProb(d2);

  // live / upcoming
  const status = m.status || m["@status"] || "";
  const live = !!status && status.toLowerCase() !== "not started" &&
               !["finished","cancelled","retired","abandoned","postponed","walk over"]
                 .includes(status.toLowerCase());

  // If we don't have odds, return PENDING -> UI θα δείξει SET n / SOON
  if (!Number.isFinite(q1) || !Number.isFinite(q2)) {
    const setNum = setNumberFromPlayers(players);
    return {
      label: "PENDING",
      conf: 0.6,
      kellyLevel: "LOW",
      tip: null,
      features: { setNum, live, haveOdds: false }
    };
  }

  // Favorite from implied probs
  const favIdx = q1 >= q2 ? 0 : 1;
  const favName = favIdx === 0 ? name1 : name2;
  const probDiff = Math.abs(q1 - q2);       // 0 .. ~0.5
  const setNum = setNumberFromPlayers(players);

  // Confidence: base on probDiff + small bonus for deeper sets when live
  let conf = 0.55 + probDiff * 0.9;
  if (live && setNum >= 2) conf += 0.05 * (setNum - 1); // +0.05, +0.10 ...
  if (!live) conf -= 0.05;                               // pre-match λίγο πιο κάτω
  conf = clamp(conf, 0.55, 0.96);

  // Label rules (σταθερά, χωρίς να γεμίζει AVOID)
  // - SAFE: live, set>=2, probDiff>=0.20
  // - RISKY: (live && probDiff>=0.10) ή (pre && probDiff>=0.14)
  // - AVOID: live με πολύ χαμηλό edge
  // - αλλιώς PENDING (UI -> SET n / SOON)
  let label = "PENDING";
  if (live) {
    if (setNum >= 2 && probDiff >= 0.20) label = "SAFE";
    else if (probDiff >= 0.10)           label = "RISKY";
    else if (probDiff < 0.06)            label = "AVOID";
  } else {
    if (probDiff >= 0.14) label = "RISKY";
  }

  // Kelly bucket από conf
  const kellyLevel = conf >= 0.85 ? "HIGH" : conf >= 0.72 ? "MED" : "LOW";

  // TIP μόνο όταν το σήμα δεν είναι PENDING/AVOID
  const tip = (label === "SAFE" || label === "RISKY") ? favName : null;

  return {
    label,
    conf,
    kellyLevel,
    tip,
    features: {
      fav: favName,
      probDiff: Number(probDiff.toFixed(3)),
      q1: Number(q1.toFixed(3)),
      q2: Number(q2.toFixed(3)),
      setNum,
      live
    }
  };
}