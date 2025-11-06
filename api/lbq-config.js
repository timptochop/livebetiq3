// api/lbq-config.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Αν θέλουμε να χρησιμοποιήσουμε ακριβώς τα ίδια config από το lbqcc:
    const url = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/lbqcc?ts=${Date.now()}`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) {
      return res.status(500).json({ ok: false, error: `lbqcc proxy http ${r.status}` });
    }
    const data = await r.json();

    // Επιστρέφουμε μόνο τα απολύτως χρήσιμα στο UI (π.χ. cutoffs, engine κτλ.)
    return res.status(200).json({
      ok: true,
      engine: data?.config?.engine ?? 'v5',
      config: {
        log_predictions: data?.config?.log_predictions ?? 0,
      },
      // Προαιρετικά: thresholds αν τα περνάς από GAS. Αν όχι, βάζουμε defaults.
      cutoffs: {
        thrSafe: 0.61,       // default example
        thrRisky: 0.4,       // default example
        minEV: 0.02,         // default example
      },
      via: 'proxy:lbqcc',
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}