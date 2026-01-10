// api/gs/tennis-live.js
export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  res.status(200).json({
    FORCE: true,
    FILE: "api/gs/tennis-live.js",
    BUILD: "FORCE_HANDLER_OVERRIDE_v1",
    TIME: new Date().toISOString(),
    URL: req.url,
  });
}