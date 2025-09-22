const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const CONTACT       = process.env.PUSH_CONTACT || 'mailto:admin@example.com';

// set once (αν λείπουν envs, θα ρίξει στο sendNotification)
try { if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
}} catch {}

const parseJson = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.end('Method Not Allowed');
  }

  try {
    const body = (req.body && Object.keys(req.body).length) ? req.body : await parseJson(req);
    const { subscription, title, body: text, url } = body || {};
    if (!subscription || !subscription.endpoint) {
      res.statusCode = 400; return res.end('No subscription');
    }

    const payload = JSON.stringify({
      title: title || 'LiveBet IQ',
      body:  text  || 'Push',
      url:   url   || '/'
    });

    const rsp = await webpush.sendNotification(subscription, payload);
    res.setHeader('Content-Type', 'application/json');
    // web-push συνήθως δεν επιστρέφει body, αλλά κρατάμε status αν υπάρχει
    return res.end(JSON.stringify({ ok: true, statusCode: rsp && rsp.statusCode || 201 }));
  } catch (e) {
    // π.χ. 410 = Gone (άκυρο subscription), 400 = VAPID error, αλλιώς 500
    res.statusCode = e && e.statusCode ? e.statusCode : 500;
    return res.end(String(e && (e.body || e.message) || e));
  }
};