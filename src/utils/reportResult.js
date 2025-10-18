// src/utils/reportResult.js
// Robust, idempotent result reporter for /api/predictions
// - Validates inputs
// - Normalizes result values
// - Deduplicates per matchId within a session
// - Times out the request to avoid hanging promises

const SENT_MATCH_IDS = new Set();

/**
 * Report a finished match result to the serverless endpoint.
 * @param {Object} params
 * @param {string} params.matchId - MUST be identical to the prediction matchId.
 * @param {'win'|'loss'|'retired'|string} params.result - Result outcome.
 * @param {string=} params.winner - Winner player name (optional but recommended).
 * @param {string=} params.predicted - Predicted player name (optional).
 * @returns {Promise<{ok:boolean, [key:string]:any}>}
 */
export async function reportResult({ matchId, result, winner, predicted }) {
  // Basic validation
  if (!matchId || typeof matchId !== 'string') {
    return { ok: false, error: 'missing matchId' };
  }
  if (!result || typeof result !== 'string') {
    return { ok: false, error: 'missing result' };
  }

  // Normalize result value
  const normalizedResult = String(result).trim().toLowerCase();
  const allowed = new Set(['win', 'loss', 'retired']);
  if (!allowed.has(normalizedResult)) {
    return { ok: false, error: `invalid result value: "${result}"` };
  }

  // Idempotency guard (avoid duplicate posts for same match in this session)
  if (SENT_MATCH_IDS.has(matchId)) {
    return { ok: true, dedup: true, matchId };
  }

  // Abort after 8s to prevent hanging
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        event: 'result',
        matchId,
        result: normalizedResult,
        winner: winner ?? null,
        predicted: predicted ?? null,
      }),
    });

    clearTimeout(t);

    // Attempt to parse JSON safely
    const json = await resp.json().catch(() => ({}));

    // Accept any truthy ok; otherwise return a structured error
    if (json && json.ok) {
      SENT_MATCH_IDS.add(matchId);
      return json;
    }
    return {
      ok: false,
      error: 'bad response from /api/predictions',
      status: resp.status,
      response: json,
    };
  } catch (err) {
    clearTimeout(t);
    // Surface AbortError distinctly
    if (err && String(err).includes('AbortError')) {
      return { ok: false, error: 'request timeout (8s)', matchId };
    }
    return { ok: false, error: String(err), matchId };
  }
}

export default reportResult;