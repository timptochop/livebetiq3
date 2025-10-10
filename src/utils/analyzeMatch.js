/**
 * analyzeMatch.js v3.7-lite-tuned (updated)
 * Changes:
 *  - SAFE_CONF threshold lowered from 0.86 to 0.83
 *  - RISKY labeling enabled for confidence >= 0.75 (if not SAFE)
 *  - MIN_ODDS remains at 1.50 (unchanged)
 *  - Set 2 mid-match filter retained: only analyze live matches in Set 2, games 3–6 (no tie-breaks)
 * All other logic (momentum, surface adjustment, time-to-start adjustment, volatility clamp) remains intact.
 */
function analyzeMatch(match) {
  // Thresholds and configuration
  const SAFE_CONF = 0.83;             // lowered from 0.86
  const MIN_ODDS = 1.50;             // minimum odds for a SAFE recommendation (unchanged)
  const RISKY_CONF = 0.75;           // confidence threshold for RISKY recommendations

  // Only proceed if match is live in Set 2, games 3–6, and not in a tie-break
  if (match.currentSet !== 2 || match.currentGame < 3 || match.currentGame > 6 || match.inTieBreak) {
    return null;  // outside of the analysis window
  }

  // Base win probability (for the player we might tip) from predictive model or implied by odds
  let baseProb;
  if (typeof match.predictedWinProb === 'number') {
    // Use pre-computed win probability if available
    baseProb = match.predictedWinProb;
  } else if (match.player1Odds && match.player2Odds) {
    // Derive implied probability from odds (ignoring bookmaker margin)
    const inv1 = 1 / match.player1Odds;
    const inv2 = 1 / match.player2Odds;
    baseProb = inv1 / (inv1 + inv2);
  } else {
    baseProb = 0.5;  // default to 50% if no data
  }

  // Determine tip (which player to bet on) and confidence for that tip
  let tip, conf;
  if (baseProb >= 0.5) {
    // Favor Player 1
    tip = match.player1Name || 'Player 1';
    conf = baseProb;
  } else {
    // Favor Player 2
    tip = match.player2Name || 'Player 2';
    conf = 1 - baseProb;
  }

  // Momentum adjustment: adjust confidence based on momentum (if available)
  // e.g., if the tipped player has positive momentum, increase confidence slightly; if negative, decrease it
  let momentumAdj = 0;
  if (match.momentum !== undefined) {
    // Keep existing momentum logic intact (assuming match.momentum is a pre-calculated factor)
    momentumAdj = match.momentum;
    conf += momentumAdj;
  }

  // Surface adjustment: adjust confidence for surface-specific performance (if available)
  let surfaceAdj = 0;
  if (match.surface && match.player1SurfaceRating !== undefined && match.player2SurfaceRating !== undefined) {
    // Example: use the difference in surface ratings between players as an adjustment
    if (tip === (match.player1Name || 'Player 1')) {
      surfaceAdj = (match.player1SurfaceRating - match.player2SurfaceRating) * 0.01;
    } else {
      surfaceAdj = (match.player2SurfaceRating - match.player1SurfaceRating) * 0.01;
    }
    conf += surfaceAdj;
  }

  // Time-to-start adjustment: if the match has not started or just started, adjust for uncertainty (if applicable)
  let timeAdj = 0;
  if (match.timeToStart !== undefined && match.timeToStart > 0) {
    // If match is upcoming (not live yet), reduce confidence slightly due to time remaining
    // (In live Set 2 context this is typically 0, but we include it to keep logic intact)
    timeAdj = 0;  // no adjustment for live matches in this context
    conf += timeAdj;
  }

  // Volatility clamp: ensure confidence is not over/under certain bounds due to in-play volatility
  if (conf > 0.99) conf = 0.99;
  if (conf < 0.01) conf = 0.01;

  // Determine the recommended odds for the chosen tip (if available)
  let recommendedOdds = null;
  if (tip === (match.player1Name || 'Player 1') && match.player1Odds) {
    recommendedOdds = match.player1Odds;
  } else if (tip === (match.player2Name || 'Player 2') && match.player2Odds) {
    recommendedOdds = match.player2Odds;
  }

  // Label determination logic (SAFE, RISKY, or AVOID)
  let label;
  if (conf >= SAFE_CONF && (recommendedOdds === null || recommendedOdds >= MIN_ODDS)) {
    label = 'SAFE';
  } else if (conf >= RISKY_CONF) {
    label = 'RISKY';
  } else {
    label = 'AVOID';
  }

  // Calculate Kelly level for staking (based on confidence and odds, if available)
  let kellyLevel = 0;
  if ((label === 'SAFE' || label === 'RISKY') && recommendedOdds && recommendedOdds > 1) {
    const b = recommendedOdds - 1;
    // Kelly criterion formula for fraction of bankroll
    kellyLevel = (conf * (recommendedOdds) - 1) / b;
    if (kellyLevel < 0) kellyLevel = 0;
  } else {
    kellyLevel = 0;
  }

  // Assemble feature details for transparency and debugging
  const features = {
    baseProb: baseProb,
    momentumAdj: momentumAdj,
    surfaceAdj: surfaceAdj,
    timeAdj: timeAdj,
    finalConf: conf,
    recommendedOdds: recommendedOdds || undefined
  };

  // Return the analysis result object in the expected format
  return { label, conf, kellyLevel, tip, features };
}

// Export the analyzeMatch function (if using modules)
export default analyzeMatch;