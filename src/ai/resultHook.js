// src/ai/resultHook.js
import { sendResult, sendPrediction } from '../lib/log';

async function LBQ_autoReport({ matchId, status, winner, predicted }) {
  if (!matchId || status !== 'finished') return { ok: false, reason: 'skip' };
  const result = winner && predicted && winner === predicted ? 'win' : 'loss';
  return await sendResult({ matchId, result, winner, predicted });
}

if (typeof window !== 'undefined') {
  window.LBQ_autoReport = LBQ_autoReport;
  window.LBQ_reportFinishedMatch = LBQ_autoReport;
  window.LBQ_sendResult = sendResult;
  window.LBQ_sendPrediction = sendPrediction;
}

export { LBQ_autoReport };
export default LBQ_autoReport;