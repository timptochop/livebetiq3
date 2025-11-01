// api/lbq-config.js
// LBQ – proxy προς το Google Apps Script για adaptive weights
// Σκοπός: να μην έχουμε CORS error στο browser.

export default async function handler(req, res) {
  // basic CORS ώστε το frontend (livebetiq3.vercel.app) να μπορεί να το καλέσει
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // το URL του GAS σου – ίδιο με αυτό που δουλέψαμε πριν
  const GAS_URL =
    process.env.LBQ_CONFIG_URL ||
    'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

  try {
    const resp = await fetch(GAS_URL);
    const rawText = await resp.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      // αν το GAS κάποια στιγμή γυρίσει κάτι περίεργο, δεν σπάμε το endpoint
      parsed = {
        ok: false,
        error: 'invalid-json-from-gas',
        raw: rawText,
      };
    }

    return res.status(200).json({
      ok: true,
      source: 'vercel-proxy',
      fetchedAt: new Date().toISOString(),
      data: parsed,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      source: 'vercel-proxy',
      error: err?.message || 'fetch-failed',
    });
  }
}