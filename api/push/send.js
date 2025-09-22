// api/push/send.js
import webpush from 'web-push';

const contact = process.env.PUSH_CONTACT;
const pub     = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const priv    = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

webpush.setVapidDetails(contact, pub, priv);

export default async function handler(req, res) {
  if (!globalThis.__PUSH_STORE) globalThis.__PUSH_STORE = new Map();
  const subs = [...globalThis.__PUSH_STORE.values()];

  const payload = req.body?.payload || {
    title: 'LiveBet IQ',
    body:  'Test push ✅',
    tag:   'livebetiq:test',
    url:   '/'
  };

  const results = await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s, JSON.stringify(payload));
      return { ok: true, endpoint: s.endpoint };
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        globalThis.__PUSH_STORE.delete(s.endpoint); // καθάρισμα
      }
      return { ok:false, endpoint:s.endpoint, error:e.message };
    }
  }));

  res.json({ sent: results.filter(r=>r.ok).length, total: subs.length, results });
}