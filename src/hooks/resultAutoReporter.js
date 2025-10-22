const SENT = new Set();

async function autoReport(update = {}) {
  const matchId = String(update.matchId || '').trim();
  if (!matchId) return { ok: false, reason: 'no-matchId' };
  if (!update.status || String(update.status).toLowerCase() !== 'finished') {
    return { ok: false, reason: 'not-finished' };
  }
  if (SENT.has(matchId)) return { ok: true, dup: true };

  const winner = update.winner || '';
  const predicted = update.predicted || '';
  let result = update.result;
  if (!result) {
    if (winner && predicted) result = winner === predicted ? 'win' : 'loss';
  }
  if (!result) result = 'win';

  const res = await (window.LBQ_reportFinishedMatch
    ? window.LBQ_reportFinishedMatch({ matchId, result, winner, predicted })
    : Promise.resolve({ ok: false, reason: 'no-hook' }));

  if (res && res.ok) SENT.add(matchId);
  return res || { ok: false };
}

if (typeof window !== 'undefined') {
  window.LBQ_autoReport = autoReport;
}

export default autoReport;