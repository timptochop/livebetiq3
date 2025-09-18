// src/utils/predictionLogger.js
//
// Απλός client-side logger για SAFE/RISKY picks + έκβαση όταν ολοκληρωθεί το ματς.
// Αποθηκεύει σε localStorage (safe για Vercel/CSR). Καμία αλλαγή UI.
//
// API:
//  - logger.logPrediction({...})
//  - logger.syncWithFeed(feedArray)   // για να κλείνουμε entries όταν τελειώνει ένας αγώνας
//  - logger.exportCSV()               // επιστρέφει { filename, dataUrl } για download
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

// Προσπάθεια να βρούμε νικητή στο feed (GoalServe διάφορες μορφές)
function extractWinnerNameFromMatch(m) {
  const players = Array.isArray(m.players) ? m.players : Array.isArray(m.player) ? m.player : [];
  if (players.length >= 2) {
    // winner flag σε κάθε παίκτη;
    for (const p of players) {
      const w = (p.winner ?? p['@winner'] ?? p.won ?? p['@won'] ?? '').toString().toLowerCase();
      if (w === 'true' || w === '1') return p.name || p['@name'] || null;
    }
  }
  // μερικές φορές υπάρχει top-level "winner"
  const topWinner = m.winner ?? m['@winner'];
  if (topWinner) return String(topWinner);
  return null;
}

// Κοινός τρόπος για stable id από το feed
function getSrcId(m) {
  const a = m.id ?? m['@id'];
  if (a) return String(a);
  // fallback: όσο πιο σταθερό μπορούμε
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

  logPrediction: ({ id, name1, name2, setNum, label, tip, kellyLevel, statusAtPick }) => {
    if (!id || !label) return;
    const rows = readAll();

    // Μην ξαναγράψεις αν υπάρχει ήδη ίδια open εγγραφή για το ίδιο match
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
      result: null,          // 'HIT' | 'MISS'
      winner: null,
      closedAt: null
    });
    writeAll(rows);
  },

  // Καλείται με ΩΜΟ feed για να κλείνει open entries όταν ένα ματς τελειώσει
  syncWithFeed: (feedArray) => {
    if (!Array.isArray(feedArray) || feedArray.length === 0) return;
    const rows = readAll();
    if (rows.length === 0) return;

    // φτιάξε index: id -> match
    const idx = new Map();
    for (const m of feedArray) {
      idx.set(getSrcId(m), m);
    }

    let changed = false;
    for (const r of rows) {
      if (r.closedAt) continue; // ήδη κλειστό
      const m = idx.get(r.id);
      if (!m) continue;

      const status = String(m.status || m['@status'] || '').toLowerCase();
      const finished = ['finished','cancelled','retired','abandoned','postponed','walk over'].includes(status);
      if (!finished) continue;

      const winnerName = extractWinnerNameFromMatch(m);
      if (winnerName) {
        const hit = (r.tip && winnerName && r.tip.toLowerCase() === winnerName.toLowerCase());
        r.result = hit ? 'HIT' : 'MISS';
        r.winner = winnerName;
        r.closedAt = nowISO();
        changed = true;
      } else {
        // Αν δεν δίνει winner, απλά κλείστο ως unknown result
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
      'ts','id','name1','name2','setNum','label','tip','kellyLevel','statusAtPick','result','winner','closedAt'
    ];
    const lines = [headers.join(',')];

    for (const r of rows) {
      const vals = headers.map(h => {
        const v = r[h] ?? '';
        // escape CSV
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
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