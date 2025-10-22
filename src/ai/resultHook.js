// src/ai/resultHook.js
import { sendResult } from '../lib/log';

export async function reportIfFinished({ matchId, status, winner, predicted }) {
  if (!matchId || status !== 'finished') return { ok: true, skipped: true };
  const result = winner && predicted && winner === predicted ? 'win' : 'loss';
  return await sendResult({ matchId, result, winner, predicted });
}

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = reportIfFinished;
  window.LBQ_autoReport = async ({ matchId, winner, predicted }) =>
    reportIfFinished({ matchId, status: 'finished', winner, predicted });
}