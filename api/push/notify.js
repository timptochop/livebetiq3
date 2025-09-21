// api/push/notify.js
import webpush from 'web-push';

const PUB  = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const PRIV = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const CONTACT = process.env.PUSH_CONTACT || 'mailto:example@example.com';

webpush.setVapidDetails(CONTACT, PUB, PRIV);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed'); return;
    }
    const body = await readJSON(req);
    const { subscription, title = 'LiveBet IQ', body: text = 'Push', url = '/' } = body || {};
    if (!subscription || !subscription.endpoint) {
      res.status(400).send('Missing subscription'); return;
    }

    const payload = JSON.stringify({ title, body: text, url });
    await webpush.sendNotification(subscription, payload);

    res.setHeader('Content-Type','application/json');
    res.status(200).send(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('notify error:', err);
    res.status(500).send('ERR: ' + (err?.message || 'unknown'));
  }
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}