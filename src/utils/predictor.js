// src/utils/predictor.js
import engineV2 from './aiEngineV2';
import { logPrediction } from './predictionLogger';

const FIN = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
function isFinishedLike(s){ return FIN.has(String(s||'').toLowerCase()); }
function isUpcomingLike(s){
  const v = String(s||'').toLowerCase();
  return v === 'not started' || v === 'upcoming' || v === 'scheduled';
}
function isLive(m){
  const s = String(m.status || m['@status'] || '').toLowerCase();
  if (isUpcomingLike(s) || isFinishedLike(s)) return false;
  if (/(live|in ?play|1st|2nd|3rd|set|tiebreak|tb|susp|delay)/.test(s)) return true;
  return Number(m.setNum || 0) > 0;
}

export default function predict(m = {}){
  const useV2 = String(process.env.REACT_APP_AI_ENGINE || 'v2').toLowerCase() === 'v2';

  let pred = null;
  if (useV2) pred = engineV2(m);

  if (!pred || (pred.label == null && pred.tip == null)) {
    // Fallback, χωρίς AVOID
    const live = isLive(m);
    const setNum = Number(m.setNum || 0);
    if (!live) pred = { label: null, conf: 0.5, kellyLevel: null, tip: null, raw: { reason: 'upcoming' } };
    else if (setNum >= 3) pred = { label: `SET ${setNum}`, conf: 0.82, kellyLevel: 'MED', tip: null };
    else if (setNum === 2) pred = { label: `SET 2`, conf: 0.76, kellyLevel: 'LOW', tip: null };
    else {
      const p = Array.isArray(m.players) ? m.players : (Array.isArray(m.player) ? m.player : []);
      const a = (p[0]?.name || p[0]?.['@name'] || '').length;
      const b = (p[1]?.name || p[1]?.['@name'] || '').length;
      if (Math.abs(a - b) >= 3) {
        const fav = a > b ? (p[0]?.name || p[0]?.['@name'] || '') : (p[1]?.name || p[1]?.['@name'] || '');
        pred = { label: 'RISKY', conf: 0.74, kellyLevel: 'LOW', tip: fav, raw: { reason: 'fallback-heur' } };
      } else {
        pred = { label: null, conf: 0.6, kellyLevel: null, tip: null, raw: { reason: 'fallback-none' } };
      }
    }
  }

  logPrediction(m, pred);
  return pred;
}