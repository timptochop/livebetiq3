// ΜΗΝ βάλεις default export εδώ.
export async function LBQ_reportIfFinished({ matchId, status, winner, predicted }) {
  if (!matchId) return { ok: false, reason: 'no-id' };
  if (status !== 'finished') return { ok: false, reason: 'not-finished' };

  const result =
    winner && predicted ? (winner === predicted ? 'win' : 'loss') : 'loss';

  try {
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'result',
        matchId,
        result,
        winner,
        predicted
      })
    });
    return await res.json();
  } catch {
    return { ok: false, reason: 'fetch-failed' };
  }
}

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = LBQ_reportIfFinished;
}