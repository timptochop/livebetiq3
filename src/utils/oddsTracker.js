// src/utils/oddsTracker.js
// Lightweight client-side line movement tracker (localStorage).
// Stores last seen odds per match (stable id) and returns % movement since previous snapshot.
// Positive value => odds SHORTENED (good for the pick). Negative => odds DRIFTED (bad).

const KEY = "lbq_odds_snap_v1";
const MAX_ITEMS = 800;         // cap snapshots
const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24h

function safeParse(s, fb) { try { return JSON.parse(s); } catch { return fb; } }
function readAll() {
  if (typeof window === "undefined") return {};
  return safeParse(localStorage.getItem(KEY), {});
}
function writeAll(obj) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}

export function stableMatchId(match, name1, name2) {
  const a = match?.id ?? match?.["@id"];
  if (a) return String(a);
  const date = match?.date ?? match?.["@date"] ?? "";
  const time = match?.time ?? match?.["@time"] ?? "";
  return `${date}-${time}-${name1}-${name2}`;
}

// returns relative movement from previous odds to current: (prev - curr)/prev
// example: prev 2.00 -> now 1.80 => (2 - 1.8)/2 = +0.10 (i.e., +10% shorten)
function relMove(prevOdd, curOdd) {
  if (!prevOdd || !curOdd || prevOdd <= 0) return 0;
  return (prevOdd - curOdd) / prevOdd;
}

// Update snapshot & return movement for both players.
export function updateAndGetMovement(match, name1, name2, odds1, odds2) {
  const id = stableMatchId(match, name1, name2);
  const db = readAll();

  // prune occasionally
  if (Object.keys(db).length > MAX_ITEMS) {
    const entries = Object.entries(db);
    entries.sort((a, b) => (a[1]?.ts || 0) - (b[1]?.ts || 0));
    const toDrop = entries.slice(0, Math.floor(entries.length * 0.3));
    for (const [k] of toDrop) delete db[k];
  } else {
    // expire old
    const now = Date.now();
    for (const k of Object.keys(db)) {
      if ((now - (db[k]?.ts || 0)) > EXPIRE_MS) delete db[k];
    }
  }

  const prev = db[id] || {};
  const m1 = relMove(prev.o1, odds1);
  const m2 = relMove(prev.o2, odds2);

  db[id] = {
    ts: Date.now(),
    n1: name1, n2: name2,
    o1: (typeof odds1 === "number" ? odds1 : prev.o1 ?? null),
    o2: (typeof odds2 === "number" ? odds2 : prev.o2 ?? null)
  };
  writeAll(db);

  return { move1: m1, move2: m2 }; // positive => shortening
}