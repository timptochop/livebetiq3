// src/lib/log.js — καθαρό JavaScript με JSDoc για IntelliSense

/**
 * @typedef {Object} PredictionData
 * @property {string} matchId
 * @property {('SAFE'|'RISKY'|string)} label
 * @property {number} conf
 * @property {string} [tip]
 * @property {string} [favName]
 * @property {number} [favProb]
 * @property {number} [favOdds]
 * @property {number} [setNum]
 * @property {number} [live]
 * @property {number} [set2Total]
 * @property {number} [set2Diff]
 * @property {string} [surface]
 * @property {number} [catBonus]
 * @property {string} [why]
 */

/**
 * Στέλνει prediction στο /api/predictions
 * @param {PredictionData} data
 */
export async function sendPrediction(data) {
  const body = {
    ts: new Date().toISOString(),
    sid: 'live-ui',
    app: 'livebetiq3',
    model: 'v3.10',
    event: 'prediction',
    data
  };

  const res = await fetch('/api/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  try { return await res.json(); }
  catch (_) { return { ok: false, status: res.status }; }
}

/**
 * Στέλνει result (ίδιο matchId με το prediction)
 * @param {{matchId:string, result:'win'|'loss'|'retired', winner?:string, predicted?:string}} params
 */
export async function sendResult({ matchId, result, winner, predicted }) {
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

  try { return await res.json(); }
  catch (_) { return { ok: false, status: res.status }; }
}

/* -------------------------------------------------------
   Dev helpers: εκθέτουμε τις συναρτήσεις στο window για
   γρήγορο χειροκίνητο test από την κονσόλα του browser.
   ------------------------------------------------------- */
if (typeof window !== 'undefined') {
  // π.χ. LBQ_sendPrediction({ matchId:'x', label:'SAFE', conf:0.81 })
  window.LBQ_sendPrediction = sendPrediction;
  // π.χ. LBQ_sendResult({ matchId:'x', result:'win', winner:'A', predicted:'A' })
  window.LBQ_sendResult = sendResult;
}