// api/push/subscribe.js
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
    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { return res.status(400).json({ ok:false, error:'Invalid JSON' }); }
    }
    const { subscription } = body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ ok:false, error:'Missing subscription' });
    }
    // εδώ απλώς επιβεβαιώνουμε — δεν χρειάζεται web-push
    return res.status(200).json({ ok:true, saved:true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ ok:false, error: err.message || 'Server error' });
  }
};