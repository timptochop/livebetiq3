// api/push/subscribe.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed'); return;
    }
    const body = await readJSON(req);
    const { subscription } = body || {};
    if (!subscription || !subscription.endpoint) {
      res.status(400).send('Missing subscription'); return;
    }
    // εδώ θα το έγραφες σε DB αν θες. Για τώρα απλά OK
    res.setHeader('Content-Type','application/json');
    res.status(200).send(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('subscribe error:', err);
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