// src/ai/resultHook.js
// Καλείται όταν ένας αγώνας ολοκληρωθεί (status === 'finished')
// και στέλνει result στο /api/predictions χρησιμοποιώντας τον logger.

import { sendResult } from '../lib/log';

/**
 * @typedef {Object} FinishedMatch
 * @property {string} matchId              // ΠΡΕΠΕΙ να είναι ίδιο με αυτό του prediction
 * @property {'win'|'loss'|'retired'} result
 * @property {string} winner               // Νικητής όπως τον περνάει ο feed
 * @property {string} predicted            // Τι είχαμε προβλέψει (αν το έχεις διαθέσιμο)
 */

/**
 * Στείλε το RESULT για έναν τελειωμένο αγώνα.
 * Αν λείπουν πεδία, κάνουμε graceful fallback για να μην σπάει τίποτα.
 * @param {FinishedMatch} m
 * @returns {Promise<{ok:boolean, [k:string]:any}>}
 */
export async function reportFinishedMatch(m) {
  if (!m || !m.matchId) {
    return { ok: false, error: 'Missing matchId' };
  }
  // Normalise/ασφάλεια τιμών
  const payload = {
    matchId: String(m.matchId),
    result: (m.result === 'win' || m.result === 'loss' || m.result === 'retired') ? m.result : 'win',
    winner: m.winner ? String(m.winner) : '',
    predicted: m.predicted ? String(m.predicted) : ''
  };

  try {
    const res = await sendResult(payload);
    return res;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// --- Προαιρετικό: dev helper στο window για χειροκίνητο test από Console ---
if (typeof window !== 'undefined') {
  window.LBQ_reportFinishedMatch = reportFinishedMatch;
}