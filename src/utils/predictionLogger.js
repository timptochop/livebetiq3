// src/utils/predictionLogger.js
const ON = String(process.env.REACT_APP_LOG_PREDICTIONS || '0') === '1';

export function logPrediction(match, pred){
  if (!ON) return;

  try {
    const id = match.id || match['@id'] || 'no-id';
    const n1 = match.players?.[0]?.name || match.player?.[0]?.['@name'] || '';
    const n2 = match.players?.[1]?.name || match.player?.[1]?.['@name'] || '';
    const msg = `[AI ${window.__AI_VERSION__ || ''}] ${id} :: ${n1} vs ${n2} -> ${pred.label || 'null'} (${(pred.conf ?? 0).toFixed(3)}) ${pred.tip ? 'TIP:'+pred.tip : ''} ${pred.reasons ? pred.reasons.join(' | ') : ''}`;
    // console
    // eslint-disable-next-line no-console
    console.debug(msg);

    // κρατάμε ένα μικρό in-memory buffer για γρήγορο έλεγχο
    const buf = (window.__PLOG__ = window.__PLOG__ || []);
    buf.push({ t: Date.now(), id, n1, n2, pred });
    if (buf.length > 200) buf.shift();
  } catch {}
}