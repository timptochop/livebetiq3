// CommonJS για Vercel Node runtime
const parseJson = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });

module.exports = async (req, res) => {
  // Προαιρετικό preflight
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.end('Method Not Allowed');
  }

  try {
    // Σε Vercel μπορεί να ΜΗΝ υπάρχει αυτόματο parsing — το κάνουμε safe
    const body = (req.body && Object.keys(req.body).length) ? req.body : await parseJson(req);
    const sub = body && body.subscription;
    if (!sub || !sub.endpoint) {
      res.statusCode = 400;
      return res.end('No subscription');
    }

    // (εδώ θα έκανες persist σε DB – προς το παρόν απλώς απαντάμε OK)
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, endpoint: sub.endpoint.slice(0, 40) + '…' }));
  } catch (e) {
    res.statusCode = 500;
    return res.end('ERR ' + (e && e.message ? e.message : String(e)));
  }
};