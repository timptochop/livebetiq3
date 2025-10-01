// src/utils/predictor.js
import engineV2 from './aiEngineV2';

// baseline από πριν (fallback μόνο αν κάτι δεν επιστρέψει σήμα)
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

export default function predict(m = {}) {
  // 1) δοκίμασε το v2 engine
  const v2 = engineV2(m) || {};
  if (v2 && (v2.label || v2.tip || (v2.conf ?? null) !== null)) return v2;

  // 2) fallback (ποτέ AVOID)
  const live = isLive(m);
  const setNum = Number(m.setNum || 0);
  if (!live) return { label: null, conf: 0.5, kellyLevel: null, tip: null, raw: { reason: 'upcoming' } };
  if (setNum >= 3) return { label: `SET ${setNum}`, conf: 0.82, kellyLevel: 'MED', tip: null };
  if (setNum === 2) return { label: `SET 2`, conf: 0.76, kellyLevel: 'LOW', tip: null };

  const p = Array.isArray(m.players) ? m.players : (Array.isArray(m.player) ? m.player : []);
  const a = (p[0]?.name || p[0]?.['@name'] || '').length;
  const b = (p[1]?.name || p[1]?.['@name'] || '').length;
  if (Math.abs(a - b) >= 3) {
    const fav = a > b ? (p[0]?.name || p[0]?.['@name'] || '') : (p[1]?.name || p[1]?.['@name'] || '');
    return { label: 'RISKY', conf: 0.74, kellyLevel: 'LOW', tip: fav, raw: { reason: 'fallback-heur' } };
  }
  return { label: null, conf: 0.6, kellyLevel: null, tip: null, raw: { reason: 'fallback-none' } };
}