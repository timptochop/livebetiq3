// api/push/notify.js (CommonJS + safe JSON parse)
const webpush = require('web-push');

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }
  try {
    const { subscription, title = 'LiveBet IQ', body = 'Push test 🔔', url = '/' } = await parseJSON(req);
    if (!subscription || !subscription.endpoint) {
      res.statusCode = 400;
      return res.end('Missing subscription');
    }

    const { WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, PUSH_CONTACT } = process.env;
    if (!WEB_PUSH_VAPID_PUBLIC_KEY || !WEB_PUSH_VAPID_PRIVATE_KEY || !PUSH_CONTACT) {
      res.statusCode = 500;
      return res.end('Missing VAPID envs');
    }
    webpush.setVapidDetails(PUSH_CONTACT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({ title, body, url });
    await webpush.sendNotification(subscription, payload);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.statusCode = 500;
    res.end('ERR: ' + err.message);
  }
};