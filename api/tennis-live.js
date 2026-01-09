// api/gs/tennis-live.js
// Vercel API route: /api/gs/tennis-live
// Supports debug=1 to surface upstream diagnostics

import { fetchLiveTennis } from "../_lib/goalServeLiveAPI.js";

export default async function handler(req, res) {
  const debug = String(req.query?.debug || "0") === "1";

  try {
    const data = await fetchLiveTennis({ debug });

    // Keep response shape compatible with your UI probe:
    // { ok, mode, matches, meta, debug? }
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({
      ok: false,
      mode: "EMPTY",
      matches: [],
      meta: {
        build: "v10.2.5-tennis-live-guid-fallback",
        now: new Date().toISOString(),
      },
      error: "handler_failed",
      message: String(e?.message || e),
    });
  }
}