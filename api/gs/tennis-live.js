// api/gs/tennis-live.js
export default async function handler(req, res) {
  const q = req?.query || {};
  return res.status(200).json({
    ok: true,
    route: "/api/gs/tennis-live",
    signature: "GS_TENNIS_LIVE_SIGNATURE_v1",
    query: q,
    tzSeen: q.tz ?? null,
    debugSeen: q.debug ?? null,
    vSeen: q.v ?? null,
    now: new Date().toISOString(),
  });
}