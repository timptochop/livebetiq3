// src/ai/autoLogger.js
import { calculateEV, estimateConfidence, generateLabel, generateNote } from './aiEngine';
import { sendPrediction } from '../lib/log';
import { reportIfFinished } from './feedHook';

const loggedPredictions = new Set();
const loggedResults = new Set();

function pick(v, arr) {
  for (const k of arr) if (v?.[k] != null) return v[k];
  return undefined;
}
function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}
function normalizeStatus(s) {
  const t = String(s || '').toLowerCase();
  if (['live', 'inplay', 'in_play', 'playing'].includes(t)) return 'live';
  if (['finished', 'ended', 'complete', 'completed'].includes(t)) return 'finished';
  return t;
}
function playersOf(match) {
  const p1 = pick(match, ['p1','player1','home','homeName','playerA','a','A','team1','side1']) || '';
  const p2 = pick(match, ['p2','player2','away','awayName','playerB','b','B','team2','side2']) || '';
  return { p1: String(p1), p2: String(p2) };
}
function oddsOf(match) {
  const o1 = num(pick(match, ['o1','odds1','homeOdds','oddsA','oddsP1','odds?.p1','odds_home','price1','priceA']));
  const o2 = num(pick(match, ['o2','odds2','awayOdds','oddsB','oddsP2','odds?.p2','odds_away','price2','priceB']));
  return { o1, o2 };
}
function favourite({ p1, p2 }, { o1, o2 }) {
  if (Number.isFinite(o1) && Number.isFinite(o2)) {
    if (o1 <= o2) return { name: p1, odds: o1 };
    return { name: p2, odds: o2 };
  }
  return { name: p1 || p2 || 'Fav', odds: Number.isFinite(o1) ? o1 : (Number.isFinite(o2) ? o2 : NaN) };
}
function matchKey(match) {
  const mid = String(pick(match, ['matchId','id','uid','match_id','gameId']) || '');
  return mid || `${playersOf(match).p1}__${playersOf(match).p2}__${pick(match,['start','time','ts']) || ''}`;
}

export async function maybeLogPrediction(match) {
  if (String(process.env.REACT_APP_AUTO_LOGGER) !== '1') return { ok: true, skipped: 'flag-off' };
  if (!match) return { ok: false, reason: 'no-match' };

  const key = matchKey(match);
  if (!key) return { ok: false, reason: 'no-id' };
  if (loggedPredictions.has(key)) return { ok: true, skipped: 'already-sent' };

  const status = normalizeStatus(pick(match, ['status','state']));
  if (status !== 'live') return { ok: true, skipped: 'not-live' };

  const { p1, p2 } = playersOf(match);
  const { o1, o2 } = oddsOf(match);
  const fav = favourite({ p1, p2 }, { o1, o2 });

  let ev = 0;
  if (Number.isFinite(o1) && Number.isFinite(o2)) ev = calculateEV(o1, o2);
  const conf = estimateConfidence(Number.isFinite(o1) ? o1 : fav.odds, Number.isFinite(o2) ? o2 : fav.odds);
  const label = generateLabel(ev, conf);
  const why = generateNote(label, ev, conf);

  const body = {
    matchId: key,
    label,
    conf: Number((conf / 100).toFixed(2)),
    tip: fav.name ? `${fav.name} to win` : 'Fav to win',
    favName: fav.name || '',
    favProb: Number.isFinite(fav.odds) ? Number((1 / fav.odds).toFixed(2)) : undefined,
    favOdds: Number.isFinite(fav.odds) ? Number(fav.odds.toFixed(2)) : undefined,
    setNum: num(pick(match, ['set','setNum','set_number'])) || 1,
    live: 1,
    set2Total: num(pick(match, ['set2Total','set2_total'])),
    set2Diff: num(pick(match, ['set2Diff','set2_diff'])),
    surface: String(pick(match, ['surface','court','courtType']) || ''),
    catBonus: num(pick(match, ['catBonus','bonus'])),
    why
  };

  const res = await sendPrediction(body);
  if (res?.ok) loggedPredictions.add(key);
  return res || { ok: false, reason: 'no-response' };
}

export async function maybeLogResult(match) {
  if (String(process.env.REACT_APP_AUTO_RESULT) !== '1') return { ok: true, skipped: 'flag-off' };
  if (!match) return { ok: false, reason: 'no-match' };

  const key = matchKey(match);
  if (!key) return { ok: false, reason: 'no-id' };
  if (loggedResults.has(key)) return { ok: true, skipped: 'already-sent' };

  const status = normalizeStatus(pick(match, ['status','state']));
  if (status !== 'finished') return { ok: true, skipped: 'not-finished' };

  const winner = String(pick(match, ['winner','winnerName','winner_name']) || '');
  const predicted = String(pick(match, ['predicted','predictedName','predicted_name']) || winner || '');

  const res = await reportIfFinished({ id: key, matchId: key, status: 'finished', winner, predicted });
  if (res?.ok) loggedResults.add(key);
  return res || { ok: false, reason: 'no-response' };
}

export default { maybeLogPrediction, maybeLogResult };