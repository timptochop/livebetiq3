// api/gs/tennis-live.js
import { fetchLiveTennis } from "../_lib/goalServeLiveAPI.js";

export default async function handler(req, res) {
  try {
    const debug = String(req?.query?.debug || "") === "1";
    const data = await fetchLiveTennis({ debug });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      ok: false,
      mode: "ERROR",
      matches: [],
      meta: {
        build: "v10.4.0-tennis-live-api-wrapper",
        error: "fetch_failed",
        message: err?.message || "unknown_error",
      },
    });
  }
}