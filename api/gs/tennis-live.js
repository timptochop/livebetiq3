// api/gs/tennis-live.js
import { fetchLiveTennis } from "../_lib/goalServeLiveAPI.js";

export default async function handler(req, res) {
  try {
    const debug = String(req.query?.debug || "") === "1";
    const data = await fetchLiveTennis({ debug });

    // Debug returns full diagnostic object
    if (debug) return res.status(200).json(data);

    // UI-safe shape always
    return res.status(200).json({
      matches: Array.isArray(data?.matches) ? data.matches : [],
    });
  } catch (err) {
    // Never break UI
    return res.status(200).json({
      matches: [],
      ok: false,
      mode: "ERROR",
      meta: { error: err?.message || "unknown_error" },
    });
  }
}