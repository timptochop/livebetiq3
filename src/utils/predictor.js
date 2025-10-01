// src/utils/predictor.js
const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);

function isFinishedLike(s) { return FINISHED.has(String(s || '').toLowerCase()); }
function isUpcomingLike(s) {
  const v = String(s || '').toLowerCase();
  return v === 'not started' || v === 'upcoming' || v === 'scheduled';
}
function isLive(m) {
  const s = String(m.status || m['@status'] || '').toLowerCase();
  if (isUpcomingLike(s) || isFinishedLike(s)) return false;
  if (/(live|in ?play|1st|2nd|3rd|set|tiebreak|tb|susp|delay)/.test(s)) return true;
  return (m.setNum || 0) > 0;
}

export default function predict(m = {}) {
  const live = isLive(m);
  const setNum = Number(m.setNum || 0);

  // --- απλές, σταθερές ευρετικές χωρίς AVOID ---
  // Αν δεν είναι live -> άστο στο UI να δείξει SOON
  if (!live) {
    return { label: null, conf: 0.5, kellyLevel: null, tip: null, raw: { reason: 'upcoming' } };
  }

  // Αν είμαστε σε προχωρημένο set, δείξε “SET n”
  if (setNum >= 3) return { label: `SET ${setNum}`, conf: 0.82, kellyLevel: 'MED', tip: null };
  if (setNum === 2) return { label: `SET 2`, conf: 0.76, kellyLevel: 'LOW', tip: null };

  // Light “SAFE”/“RISKY” πιλότος (μέχρι να ανεβάσουμε το μοντέλο v2):
  // όνομα με μεγαλύτερο μήκος -> dummy σήμα ως placeholder
  const p = Array.isArray(m.players) ? m.players : (Array.isArray(m.player) ? m.player : []);
  const a = (p[0]?.name || p[0]?.['@name'] || '').length;
  const b = (p[1]?.name || p[1]?.['@name'] || '').length;

  if (Math.abs(a - b) >= 3) {
    const fav = a > b ? (p[0]?.name || p[0]?.['@name'] || '') : (p[1]?.name || p[1]?.['@name'] || '');
    return { label: 'RISKY', conf: 0.74, kellyLevel: 'LOW', tip: fav, raw: { reason: 'baseline-heuristic' } };
  }

  // default: χωρίς σήμα -> αφήνουμε το UI να δείξει SET 1
  return { label: null, conf: 0.6, kellyLevel: null, tip: null, raw: { reason: 'no-strong-signal' } };
}