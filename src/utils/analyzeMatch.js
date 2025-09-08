// Corrected imports
import calculateEV from './aiPredictionEngineModules/calculateEV';
import estimateConfidence from './aiPredictionEngineModules/estimateConfidence';
import calculateKelly from './aiPredictionEngineModules/calculateKelly';
import detectLineMovement from './aiPredictionEngineModules/detectLineMovement';
import surfaceAdjustment from './aiPredictionEngineModules/surfaceAdjustment';
import timeWeightedForm from './aiPredictionEngineModules/timeWeightedForm';
import generateLabel from './aiPredictionEngineModules/generateLabel';
import generateNote from './aiPredictionEngineModules/generateNote';

export default async function analyzeMatch(match) {
  try {
    const { home, away, odds, raw, status, tournament } = match;

    const setNumber = extractSetNumber(status);
    const isLive = isLiveMatch(status);

    if (!home || !away || !odds) return null;
    if (!odds?.odds?.[0]?.bookmaker) return null;

    const fairOdds = extractFairOdds(odds);
    if (!fairOdds || fairOdds.prob1 === 0 || fairOdds.prob2 === 0) return null;

    const inputs = {
      home,
      away,
      status,
      setNumber,
      tournament,
      fairOdds,
      momentum: 0,
      surface: extractSurface(tournament),
      formHome: null,
      formAway: null,
      lineMovement: null,
    };

    const formData = await timeWeightedForm(home, away);
    inputs.formHome = formData.homeForm;
    inputs.formAway = formData.awayForm;

    const surfaceBoost = surfaceAdjustment(inputs.surface);
    const lineMovement = detectLineMovement(odds);
    inputs.lineMovement = lineMovement?.movement || null;

    const momentumBonus = calculateMomentumBonus(match?.score);
    inputs.momentum = momentumBonus;

    const ev = calculateEV(fairOdds) + momentumBonus + surfaceBoost;
    const confidence = estimateConfidence(ev, momentumBonus, surfaceBoost, inputs);
    const kelly = calculateKelly(ev, confidence);
    const label = generateLabel({ ev, confidence, setNumber });
    const note = generateNote({ ev, confidence, label, fairOdds, momentumBonus });

    console.table({
      matchId: match.id,
      home,
      away,
      ev: ev.toFixed(3),
      confidence: Math.round(confidence) + '%',
      label,
      kelly: kelly.toFixed(2),
      set: setNumber,
      momentum: momentumBonus,
      surface: inputs.surface,
      formHome: inputs.formHome,
      formAway: inputs.formAway,
      lineMove: inputs.lineMovement,
    });

    return {
      ...match,
      ev,
      confidence,
      label,
      tip: label === 'SAFE' ? `TIP: ${home}` : null,
      note,
      kelly,
    };
  } catch (err) {
    console.error('[AI] analyzeMatch error:', err.message);
    return null;
  }
}

// Helpers

function extractSetNumber(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('set 3')) return 3;
  if (s.includes('set 2')) return 2;
  if (s.includes('set 1')) return 1;
  return s.includes('in progress') ? 1 : 0;
}

function isLiveMatch(status) {
  const s = String(status || '').toLowerCase();
  return s.includes('in progress') || s.includes('live') || s.includes('set');
}

function extractSurface(tournament) {
  const s = tournament.toLowerCase();
  if (s.includes('clay')) return 'clay';
  if (s.includes('grass')) return 'grass';
  if (s.includes('hard')) return 'hard';
  return 'unknown';
}

function extractFairOdds(odds) {
  try {
    const bookmaker = odds.odds[0].bookmaker[0];
    const o1 = parseFloat(bookmaker.odds?.[0]?._);
    const o2 = parseFloat(bookmaker.odds?.[1]?._);
    if (!o1 || !o2) return null;
    const prob1 = 1 / o1;
    const prob2 = 1 / o2;
    return { o1, o2, prob1, prob2 };
  } catch (e) {
    return null;
  }
}

function calculateMomentumBonus(score) {
  try {
    const sets = score?.set || [];
    if (!Array.isArray(sets) || sets.length < 2) return 0;
    const lastSet = sets[sets.length - 1];
    const [h, a] = [parseInt(lastSet.home), parseInt(lastSet.away)];
    if (h > a) return 0.005;
    if (a > h) return -0.005;
    return 0;
  } catch (e) {
    return 0;
  }
}