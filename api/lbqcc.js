// api/lbqcc.js — v5.1.10-debug-passthrough
// Node 20 (Vercel). ESM source, compiled to CJS by Vercel.
// Purpose: fast local ping + strict JSON passthrough proxy to GAS, with POST body debug logs.

export default async function handler(req, res) {
  const ts = new Date().toISOString();
  const { method, query } = req;

  try {
    // 0) Fast local ping (no proxy)
    if (String(query.mode || '').toLowerCase() === 'ping') {
      return res.status(200).json({ ok: true, via: 'local', webapi: 'v5.1.10-debug-passthrough', ts });
    }

    // 1) Resolve GAS endpoint from env
    const GAS = process.env.LBQ_GAS_URL;
    if (!GAS) {
      return res.status(500).json({ ok: false, error: 'missing_env_LBQ_GAS_URL' });
    }

    // 2) Build target URL (keep all query params)
    const url = new URL(GAS);
    for (const [k, v] of Object.entries(query || {})) {
      url.searchParams.set(k, String(v));
    }

    // 3) Proxy options
    const controller = new AbortController();
    const timeoutMs = 4500; // keep short to avoid 504 from Vercel edge
    const to = setTimeout(() => controller.abort(), timeoutMs);

    let fetchOpts = { method, signal: controller.signal, headers: {} };

    if (method === 'POST') {
      const raw = await readRawBody(req);
      // Debug log (safe snippet only)
      console.log(
        JSON.stringify({
          route: '/api/lbqcc',
          ts,
          method,
          url: url.toString(),
          rawLen: raw?.length || 0,
          rawHead: (raw || '').slice(0, 200)
        })
      );

      // Preserve incoming content-type if present
      const ct = req.headers['content-type'] || 'application/json';
      fetchOpts.headers['content-type'] = ct;
      fetchOpts.body = raw || '{}';
    }

    // 4) Forward to GAS
    const upstream = await fetch(url.toString(), fetchOpts);

    // 5) Passthrough response as-is (text)
    const text = await upstream.text();
    clearTimeout(to);

    // Mirror upstream status and content-type
    res.status(upstream.status || 200);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(text);
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || e.code === 'ABORT_ERR');
    const msg = e?.message || String(e);
    console.error(JSON.stringify({ route: '/api/lbqcc', ts, error: aborted ? 'timeout' : 'exception', message: msg }));
    return res.status(aborted ? 504 : 500).json({
      ok: false,
      error: aborted ? 'timeout' : 'exception',
      message: msg
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