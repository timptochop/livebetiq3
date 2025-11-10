// /api/lbqcc.js  — v5.1.8-fastping-proxy
// Node 20 (Vercel). ESM source, compiled to CJS από Vercel.
// Purpose: fast local ping + strict JSON passthrough proxy προς GAS.

export default async function handler(req, res) {
  try {
    const ts = new Date().toISOString();
    const { method, query } = req;

    // 0) Fast local ping (χωρίς proxy)
    if (String(query.mode || '').toLowerCase() === 'ping') {
      return res.status(200).json({ ok: true, via: 'local', webapi: 'v5.1.8-fastping', ts });
    }

    // 1) Resolve GAS endpoint
    const GAS = process.env.LBQ_GAS_URL;
    if (!GAS) {
      return res.status(500).json({ ok: false, error: 'missing_env_LBQ_GAS_URL' });
    }

    // 2) Build target URL (κρατάμε όλα τα query params)
    const url = new URL(GAS);
    for (const [k, v] of Object.entries(query || {})) {
      url.searchParams.set(k, v);
    }

    // 3) Prepare fetch options
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s hard cap

    const headers = { 'accept': 'application/json' };

    let bodyText = undefined;
    if (method === 'POST') {
      // Περνάμε ΩΜΟ JSON όπως ήρθε.
      if (typeof req.body === 'string') {
        bodyText = req.body;
      } else if (req.body && Object.keys(req.body).length) {
        bodyText = JSON.stringify(req.body);
      } else {
        // Αν για κάποιο λόγο δεν έγινε body parsing, διαβάζουμε το raw stream.
        bodyText = await readRawBody(req);
      }
      headers['content-type'] = 'application/json';
    }

    // 4) Proxy to GAS
    const resp = await fetch(url.toString(), {
      method,
      headers,
      body: method === 'POST' ? bodyText : undefined,
      signal: controller.signal,
    }).catch(err => {
      // fetch-level error
      throw new Error(`fetch_failed:${err.name}:${err.message}`);
    });
    clearTimeout(timeout);

    // 5) Passthrough JSON (ή text fallback)
    const text = await resp.text();
    const status = resp.status;

    // Προσπαθούμε JSON, αλλιώς επιστρέφουμε text με wrapper
    try {
      const json = JSON.parse(text);
      return res.status(status).json(json);
    } catch {
      return res.status(status).json({ ok: false, via: 'proxy', note: 'non_json_from_gas', status, text });
    }
  } catch (err) {
    const msg = (err && err.message) || String(err);
    const aborted = msg.includes('AbortError') || msg.includes('aborted');
    return res.status(504).json({
      ok: false,
      via: 'proxy',
      error: aborted ? 'timeout' : 'exception',
      message: msg,
    });
  }
}

// --- helpers ---
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    try {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data || '{}'));
      req.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}