// src/utils/predictionLogger.js
// Client-side logger for SAFE/RISKY picks + outcome when match finishes.
// Stores in localStorage. No UI changes.

const KEY = 'lbq_logs_v1';

function safeJSONParse(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }
function nowISO() { return new Date().toISOString(); }

function readAll() {
  if (typeof window === 'undefined') return [];
  return safeJSONParse(localStorage.getItem(KEY), []);
}

function writeAll(arr) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {}
}

function extractWinnerNameFromMatch(m) {
  const players = Array.isArray(m?.players) ? m.players
                : Array.isArray(m?.player)  ? m.player : [];
  if (players.length >= 2) {
    for (const p of players) {
      const w = (p?.winner ?? p?.['@winner'] ?? p?.won ?? p?.['@won'] ?? '')
        .toString().toLowerCase();
      if (w === 'true' || w === '1') return p?.name || p?.['@name'] || null;
    }
  }
  const topWinner = m?.winner ?? m?.['@winner'];
  if (topWinner) return String(topWinner);
  return null;
}

function getSrcId(m) {
  const a = m?.id ?? m?.['@id'];
  if (a) return String(a);
  const date = m?.date ?? m?.['@date'] ?? '';
  const time = m?.time ?? m?.['@time'] ?? '';
  const p = Array.isArray(m?.players) ? m.players : Array.isArray(m?.player) ? m.player : [];
  const p1 = p[0]?.name || p[0]?.['@name'] || '';
  const p2 = p[1]?.name || p[1]?.['@name'] || '';
  return `${date}-${time}-${p1}-${p2}`;
}

const logger = {
  read: () => readAll(),
  clear: () => writeAll([]),

  logPrediction: ({ id, name1, name2, setNum, label, tip, kellyLevel, statusAtPick }) => {
    if (!id || !label) return;
    const rows = readAll();
    const hasOpen = rows.some(r => r.id === id && !r.closedAt);
    if (hasOpen) return;

    rows.push({
      id,
      ts: nowISO(),
      name1: name1 || '',
      name2: name2 || '',
      setNum: setNum ?? null,
      label,
      tip: tip || null,
      kellyLevel: kellyLevel || null,
      statusAtPick: statusAtPick || '',
      result: null, // 'HIT' | 'MISS'
      winner: null,
      closedAt: null,
    });
    writeAll(rows);
  },

  // Defensive: ignore non-objects/nulls; early return on empty
  syncWithFeed: (feedArray) => {
    const feed = Array.isArray(feedArray) ? feedArray.filter(m => m && typeof m === 'object') : [];
    if (feed.length === 0) return;

    const rows = readAll();
    if (rows.length === 0) return;

    const idx = new Map();
    for (const m of feed) idx.set(getSrcId(m), m);

    let changed = false;
    for (const r of rows) {
      if (r.closedAt) continue;
      const m = idx.get(r.id);
      if (!m) continue;

      const status = String(m?.status || m?.['@status'] || '').toLowerCase();
      const finished = ['finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over'].includes(status);
      if (!finished) continue;

      const winnerName = extractWinnerNameFromMatch(m);
      if (winnerName) {
        const hit = (r.tip && winnerName && r.tip.toLowerCase() === winnerName.toLowerCase());
        r.result = hit ? 'HIT' : 'MISS';
        r.winner = winnerName;
        r.closedAt = nowISO();
        changed = true;
      } else {
        r.result = r.result || 'MISS';
        r.closedAt = nowISO();
        changed = true;
      }
    }

    if (changed) writeAll(rows);
  },
};

export default logger;