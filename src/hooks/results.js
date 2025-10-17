// src/hooks/results.js
// Καλεί το /api/predictions με event:'result' όταν ένας αγώνας γίνει finished.

import { reportResult } from '../utils/reportResult';

/** Γρήγορο in-memory guard για να μην ξαναστείλουμε το ίδιο matchId */
const sentResults = new Set();

/** Βοηθός: βρες το ίδιο matchId που έστειλες στο 'prediction' */
function getMatchId(m) {
  return (
    m.matchId ||
    m.id ||
    m.uid ||
    m.eventId ||
    (m.meta && (m.meta.matchId || m.meta.id)) ||
    ''
  );
}

/** Βοηθός: normalized status */
function getStatus(m) {
  return String(m.status || m.gameStatus || m.state || '').toLowerCase();
}

/** Βοηθός: winner / predicted ονόματα */
function getWinner(m) {
  return (
    m.winner ||
    m.winnerName ||
    (m.result && m.result.winner) ||
    (m.meta && m.meta.winner) ||
    ''
  );
}

function getPredicted(m) {
  if (m.predicted) return m.predicted;
  if (m.predictedTip) return m.predictedTip;

  const tip = String(m.tip || m.recommendation || '').toLowerCase();
  if (tip.includes('player a')) return 'Player A';
  if (tip.includes('player b')) return 'Player B';
  return '';
}

/** Βοηθός: map σε 'win' | 'loss' | 'retired' */
function getResultFlag(m, winnerName, predictedName) {
  // Αν υπάρχει έτοιμο result από το feed
  const r = String(m.result || m.finalResult || '').toLowerCase();
  if (r === 'win' || r === 'loss' || r === 'retired') return r;

  // Retired hints
  const retiredHints = ['retired', 'walkover', 'wo', 'abandoned'];
  const status = getStatus(m);
  if (retiredHints.some((x) => status.includes(x))) return 'retired';

  // Αλλιώς infer από winner vs predicted
  if (winnerName && predictedName) {
    return winnerName === predictedName ? 'win' : 'loss';
  }

  // Fallback: αν δεν ξέρουμε winner, μην στείλεις τίποτα
  return '';
}

/**
 * Κάλεσέ το για κάθε match του feed.
 * Στέλνει result ΜΟΝΟ όταν το status δείχνει finished και δεν έχει σταλεί ξανά.
 */
export async function handleFeedMatch(m) {
  try {
    const status = getStatus(m);
    // Προχώρα μόνο όταν το feed δείξει ότι τελείωσε
    const isFinished =
      status.includes('finished') ||
      status.includes('ended') ||
      status.includes('final') ||
      status === 'ft' ||
      status === 'complete';

    if (!isFinished) return { ok: true, skipped: 'not finished' };

    const matchId = getMatchId(m);
    if (!matchId) return { ok: false, error: 'missing matchId' };
    if (sentResults.has(matchId)) return { ok: true, skipped: 'already sent' };

    const winnerName = getWinner(m);
    const predictedName = getPredicted(m);
    const resultFlag = getResultFlag(m, winnerName, predictedName);
    if (!resultFlag) return { ok: false, error: 'undetermined result' };

    // Στείλε στο logger (ενιαίο endpoint /api/predictions)
    const resp = await reportResult({
      matchId,
      result: resultFlag, // 'win' | 'loss' | 'retired'
      winner: winnerName || undefined,
      predicted: predictedName || undefined,
    });

    if (resp && resp.ok) {
      sentResults.add(matchId);
    }

    return resp || { ok: false, error: 'no response' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Προαιρετικό: batch handler για λίστα αγώνων */
export async function handleFeedBatch(matches = []) {
  const out = [];
  for (const m of matches) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await handleFeedMatch(m));
  }
  return out;
}