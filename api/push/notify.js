// CommonJS + web-push. Στέλνουμε ΣΕ subscription που μας στέλνεις στο body.

const webpush = require("web-push");

const PUBLIC = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const CONTACT = process.env.PUSH_CONTACT || "mailto:tptochop@gmail.com";

if (PUBLIC && PRIVATE) {
  webpush.setVapidDetails(CONTACT, PUBLIC, PRIVATE);
}

async function readJson(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    }

    const { subscription, title = "LiveBet IQ", body = "Push test ✅", url = "/" } = await readJson(req);

    if (!subscription) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: false, error: "Missing subscription" }));
    }

    const payload = JSON.stringify({ title, body, url });
    await webpush.sendNotification(subscription, payload);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("notify error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: err.message || "Server error" }));
  }
};