import { LBQ_reportIfFinished } from './resultHook';

export async function reportIfFinished(match) {
  if (!match) return { ok: false, reason: 'no-match' };
  const mid = String(match.matchId || match.id || '');
  if (!mid) return { ok: false, reason: 'no-id' };
  if (match.status !== 'finished') return { ok: false, reason: 'not-finished' };

  return await LBQ_reportIfFinished({
    matchId: mid,
    status: 'finished',
    winner: match.winner || '',
    predicted: match.predicted || match.winner || ''
  });
}

export default reportIfFinished;