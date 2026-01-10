// api/gs/tennis-live.js
import { fetchLiveTennisWithFallback } from "../_lib/goalServeLiveAPI.js";

export default async function handler(req, res) {
  try {
    const data = await fetchLiveTennisWithFallback();

    // No UI changes needed: UI can keep using matches.
    // probe is extra diagnostics if you need it.
    res.status(200).json({
      matches: Array.isArray(data.matches) ? data.matches : [],
      probe: data.probe || { ok: true, mode: "UNKNOWN" },
    });
  } catch (err) {
    res.status(500).json({
      matches: [],
      probe: { ok: false, mode: "ERROR", message: err?.message || "unknown_error" },
    });
  }
}