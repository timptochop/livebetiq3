// src/ai/feedHook.js
import LBQ_autoReport from './resultHook';

export async function reportIfFinished(match) {
  if (!match) return { ok: false, reason: 'no-match' };
  const { id, matchId, status, winner, predicted } = match;
  const mid = String(matchId || id || '');
  if (!mid) return { ok: false, reason: 'no-id' };
  if (status !== 'finished') return { ok: false, reason: 'not-finished' };
  return await LBQ_autoReport({
    matchId: mid,
    status: 'finished',
    winner: winner || '',
    predicted: predicted || winner || ''
  });
}
export default reportIfFinished;