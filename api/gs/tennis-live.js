// api/gs/tennis-live.js
import { fetchLiveTennis } from "../_lib/goalServeLiveAPI.js";

function withOddsKey(matches) {
  const arr = Array.isArray(matches) ? matches : [];
  return arr.map((m) => {
    const id = m?.id ?? m?.["@id"] ?? m?.matchid ?? m?.["@matchid"] ?? null;
    return {
      ...m,
      _oddsKey: String(id || ""),
    };
  });
}

export default async function handler(req, res) {
  try {
    const debug = String(req.query?.debug || "") === "1";
    const data = await fetchLiveTennis({ debug });

    const patchedMatches = withOddsKey(data?.matches);

    // Debug keeps the full shape, just with patched matches
    if (debug) {
      return res.status(200).json({
        ...data,
        matches: patchedMatches,
      });
    }

    // Non-debug: always safe shape for UI
    return res.status(200).json({
      matches: patchedMatches,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      mode: "ERROR",
      matches: [],
      meta: { error: err?.message || "unknown_error" },
    });
  }
}