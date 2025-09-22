// api/push/subscribe.js  (Vercel Node Function)
const webpush = require('web-push');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // Βεβαιώσου ότι υπάρχουν envs
    const contact = process.env.PUSH_CONTACT;
    const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    if (!contact || !pub || !priv) {
      return res.status(500).json({ ok: false, error: 'Missing VAPID envs' });
    }
    webpush.setVapidDetails(contact, pub, priv);

    // Safe JSON parse
    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { return res.status(400).json({ ok: false, error: 'Invalid JSON' }); }
    }
    const { subscription } = body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ ok: false, error: 'Missing subscription' });
    }

    // (Προς το παρόν δεν αποθηκεύουμε – απλώς επιβεβαιώνουμε)
    return res.status(200).json({ ok: true, saved: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};