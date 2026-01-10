// api/gs/tennis-live.js
export default async function handler(req, res) {
  res.status(200).json({
    OK: true,
    FORCE_HANDLER: "api/gs/tennis-live.js",
    BUILD: "FORCE-ROUTE-CHECK-v1",
    time: new Date().toISOString(),
  });
}