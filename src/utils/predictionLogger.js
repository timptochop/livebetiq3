// src/utils/predictionLogger.js
//
// Lightweight client-side logger for SAFE/RISKY picks and match outcomes.
// Stores to localStorage (CSR-safe on Vercel). No UI dependency.
//
// API:
//  - logger.logPrediction({...})
//  - logger.syncWithFeed(feedArray)   // close entries when a match finishes
//  - logger.exportCSV()               // returns { filename, dataUrl }
//  - logger.read() / logger.clear()

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

// Attempt to find winner name in various GoalServe shapes
function extractWinnerNameFromMatch(m) {
  const players = Array.isArray(m.players) ? m.players : Array.isArray(m.player) ? m.player : [];
  if (players.length >= 2) {
    for (const p of players) {
      const w = (p.winner ?? p['@winner'] ?? p.won ?? p['@won'] ?? '').toString().toLowerCase();
      if (w === 'true' || w === '1') return p.name || p['@name'] || null;
    }
  }
  const topWinner = m.winner ?? m['@winner'];
  if (topWinner) return String(topWinner);
  return null;
}

// Stable id from the upstream feed
function getSrcId(m) {
  const a = m.id ?? m['@id'];
  if (a) return String(a);
  const date = m.date ?? m['@date'] ?? '';
  const time = m.time ?? m['@time'] ?? '';
  const p = Array.isArray(m.players) ? m.players : Array.isArray(m.player) ? m.player : [];
  const p1 = p[0]?.name || p[0]?.['@name'] || '';
  const p2 = p[1]?.name || p[1]?.['@name'] || '';
  return `${date}-${time}-${p1}-${p2}`;
}

const logger = {
  read: () => readAll(),
  clear: () => writeAll([]),

  // Extended fields for Phase-1 instrumentation:
  //   surface, categoryName, setNum, gamesInSet, gameScoreA/B, serve ('A'|'B'|null),
  //   oddsSnapshot, aiVersion, statusAtPick.
  logPrediction: (row) => {
    const {
      id, label, name1 = '', name2 = '', setNum = null, tip = null,
      kellyLevel = null, statusAtPick = '', surface = null, categoryName = '',
      gamesInSet = null, gameScoreA = null, gameScoreB = null, serve = null,
      oddsSnapshot = null, aiVersion = null
    } = row || {};

    if (!id || !label) return;
    const rows = readAll();

    // do not duplicate open entry for the same match
    const hasOpen = rows.some(r => r.id === id && !r.closedAt);
    if (hasOpen) return;

    rows.push({
      id,
      ts: nowISO(),
      label,
      tip,
      kellyLevel,
      name1,
      name2,
      setNum,
      statusAtPick,
      surface,
      categoryName,
      gamesInSet,
      gameScoreA,
      gameScoreB,
      serve,
      oddsSnapshot,
      aiVersion,
      result: null,   // 'HIT' | 'MISS'
      winner: null,
      closedAt: null
    });

    writeAll(rows);
  },

  // Sync with raw feed to close finished matches and mark HIT/MISS
  syncWithFeed: (feedArray) => {
    if (!Array.isArray(feedArray) || feedArray.length === 0) return;
    const rows = readAll();
    if (rows.length === 0) return;

    const idx = new Map();
    for (const m of feedArray) idx.set(getSrcId(m), m);

    let changed = false;
    for (const r of rows) {
      if (r.closedAt) continue;
      const m = idx.get(r.id);
      if (!m) continue;

      const status = String(m.status || m['@status'] || '').toLowerCase();
      const finished = ['finished','cancelled','retired','abandoned','postponed','walk over'].includes(status);
      if (!finished) continue;

      const winnerName = extractWinnerNameFromMatch(m);
      if (winnerName) {
        const hit = (r.tip && winnerName && r.tip.toLowerCase() === winnerName.toLowerCase());
        r.result = hit ? 'HIT' : 'MISS';
        r.winner  = winnerName;
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

  exportCSV: () => {
    const rows = readAll();
    const headers = [
      'ts','id','label','tip','kellyLevel','name1','name2','setNum','statusAtPick',
      'surface','categoryName','gamesInSet','gameScoreA','gameScoreB','serve',
      'oddsSnapshot','aiVersion','result','winner','closedAt'
    ];
    const lines = [headers.join(',')];

    for (const r of rows) {
      const vals = headers.map(h => {
        const v = r[h] ?? '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      });
      lines.push(vals.join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const dataUrl = URL.createObjectURL(blob);
    const filename = `lbq_logs_${Date.now()}.csv`;
    return { filename, dataUrl };
  }
};

export default logger;