// api/gs/tennis-live.js
// LiveBet IQ — GoalServe tennis live proxy (LOCKDOWN+ safe)
// Behavior:
// - debug=1  -> returns full internal payload from fetchLiveTennis()
// - no debug -> returns minimal { matches: [] } shape for UI stability
// - ALWAYS returns 200 (UI must not die)

import { fetchLiveTennis } from "../_lib/goalServeLiveAPI.js";

export default async function handler(req, res) {
  const q = req?.query || {};
  const debug = String(q.debug || "") === "1";

  try {
    const data = await fetchLiveTennis({ debug });

    // Debug mode: return everything exactly as backend produced it
    if (debug) {
      return res.status(200).json(
        data && typeof data === "object"
          ? data
          : { ok: false, mode: "DEBUG_INVALID", matches: [], meta: { error: "invalid_debug_payload" } }
      );
    }

    // Non-debug: UI-safe minimal payload
    const matches = Array.isArray(data?.matches) ? data.matches : Array.isArray(data) ? data : [];

    return res.status(200).json({ matches });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      mode: "ERROR",
      matches: [],
      meta: {
        error: err?.message || "unknown_error",
      },
    });
  }
}