// api/lbq-config.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Καλούμε τον δικό μας lbqcc με GET (mode=config) στο ίδιο deployment
    const base =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT || 3000}`;

    const url = `${base}/api/lbqcc?mode=config&ts=${Date.now()}`;
    const r = await fetch(url, { method: 'GET', headers: { 'x-from': 'lbq-config' } });

    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return res
        .status(r.status)
        .json({ ok: false, error: `lbqcc proxy http ${r.status}`, body });
    }

    const data = await r.json();
    // Επιστρέφουμε μόνο τα χρήσιμα (ok, data.config, ts...)
    return res.status(200).json({ ok: true, via: 'proxy:get', data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}