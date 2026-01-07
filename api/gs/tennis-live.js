// api/gs/tennis-live.js
// LOCKDOWN hotfix: remove re-export indirection and use the stable _lib fetcher.
// Goal: /api/gs/tennis-live must NEVER crash (always returns JSON).

import * as GS from "../_lib/goalServeLiveAPI.js";

const BUILD_TAG = "v10.2.2-gs-live-hard-handler";

function pickFetcher() {
  // Prefer a live matches fetcher if present; otherwise fallback.
  if (typeof GS.fetchLiveTennis === "function") return GS.fetchLiveTennis;
  if (typeof GS.fetchPredictions === "function") return GS.fetchPredictions;
  return null;
}

export default async function handler(req, res) {
  const debug = String(req?.query?.debug || "") === "1";

  try {
    const fn = pickFetcher();
    if (!fn) {
      return res.status(200).json({
        ok: false,
        mode: "EMPTY",
        matches: [],
        error: "missing_fetcher",
        message: "No fetchLiveTennis/fetchPredictions exported from api/_lib/goalServeLiveAPI.js",
        meta: { build: BUILD_TAG, now: Date.now() },
      });
    }

    // Some libs return an array, others return an object with { matches }.
    const out = await fn({ debug });

    // Pass-through if it already looks like our expected payload.
    if (out && typeof out === "object" && Array.isArray(out.matches)) {
      return res.status(200).json({
        ...out,
        ok: out.ok === true ? true : out.ok === false ? false : true,
        meta: { ...(out.meta || {}), build: out?.meta?.build || BUILD_TAG },
      });
    }

    const arr = Array.isArray(out) ? out : [];
    return res.status(200).json({
      ok: true,
      mode: "TODAY",
      matches: arr,
      meta: {
        build: BUILD_TAG,
        now: Date.now(),
        counts: { total: arr.length },
      },
      ...(debug ? { debug: { note: "debug=1 enabled (gs handler)" } } : {}),
    });
  } catch (e) {
    // Never crash the function; always return JSON.
    return res.status(200).json({
      ok: false,
      mode: "EMPTY",
      matches: [],
      error: "gs_tennis_live_failed",
      message: String(e?.message || e),
      meta: { build: BUILD_TAG, now: Date.now() },
      ...(debug ? { debug: { stack: String(e?.stack || "") } } : {}),
    });
  }
}