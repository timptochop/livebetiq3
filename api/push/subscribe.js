// api/push/subscribe.js
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  try {
    const { subscription } = req.body || {};
    if (!subscription) {
      res.status(400).json({ ok: false, error: 'missing_subscription' });
      return;
    }

    const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
    const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
    const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!PUBLIC || !PRIVATE) {
      res.status(200).json({ ok: true, info: 'no_vapid_keys_configured' });
      return;
    }

    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

    // Send a welcome/demo push
    const payload = JSON.stringify({
      title: 'LiveBet IQ',
      body: 'Web Push enabled. You will receive SAFE alerts.',
      url: '/'
    });

    await webpush.sendNotification(subscription, payload);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}