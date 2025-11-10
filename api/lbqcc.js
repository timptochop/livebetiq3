// api/lbqcc.js — v5.1.9-passbody
// Node 20 (Vercel). ESM source, compiled to CJS by Vercel.
// Purpose: fast local ping + strict GET/POST proxy to GAS with raw JSON passthrough.

const WEBAPI_VERSION = 'v5.1.9-passbody';

export default async function handler(req, res) {
  const ts = new Date().toISOString();
  const { method, query } = req;

  // --- CORS (safe defaults) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');
  if (method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    // 0) Fast local ping (no proxy)
    if (String(query.mode || '').toLowerCase() === 'ping') {
      return res.status(200).json({ ok: true, via: 'local', webapi: WEBAPI_VERSION, ts });
    }

    // 1) Resolve GAS endpoint
    const GAS = process.env.LBQ_GAS_URL;
    if (!GAS) {
      return res.status(500).json({ ok: false, error: 'missing_env_LBQ_GAS_URL' });
    }

    // 2) Compose target URL (preserve all query params)
    const url = new URL(GAS);
    Object.entries(query || {}).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, String(v));
    });

    // 3) Prepare fetch options (timeout 8.5s)
    const ac = new AbortController();
    const tmo = setTimeout(() => ac.abort(), 8500);

    let fetchOpts = {
      method,
      headers: { 'Accept': 'application/json' },
      signal: ac.signal
    };

    if (method === 'POST') {
      // Read raw body exactly as received and forward 1:1
      const raw = await readRawBody(req);
      // If caller didn’t send content-type, set JSON
      const ct = req.headers['content-type'] || 'application/json';
      fetchOpts.headers['Content-Type'] = ct;
      fetchOpts.body = raw && raw.length ? raw : '{}';
    }

    // 4) Proxy to GAS
    const upstream = await fetch(url.toString(), fetchOpts);
    clearTimeout(tmo);

    // 5) Try to return JSON response as-is
    const text = await upstream.text();

    // Content-type sniff (some GAS deployments return text/plain with JSON payload)
    const isJsonLike =
      upstream.headers.get('content-type')?.includes('application/json') ||
      looksLikeJson(text);

    if (isJsonLike) {
      try {
        const json = JSON.parse(text);
        // pass-through plus small annotation
        return res
          .status(upstream.status)
          .json({ ...json, _via: 'vercel-proxy', _at: ts, _webapi: WEBAPI_VERSION });
      } catch (_) {
        // fallthrough to text payload
      }
    }

    // Non-JSON payload from GAS: wrap it
    return res.status(upstream.status).json({
      ok: upstream.ok,
      status: upstream.status,
      statusText: upstream.statusText,
      body: text,
      _via: 'vercel-proxy',
      _at: ts,
      _webapi: WEBAPI_VERSION
    });
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    const msg = String(e && e.message ? e.message : e);
    return res.status(504).json({
      ok: false,
      error: aborted ? 'timeout' : 'exception',
      message: msg,
      _webapi: WEBAPI_VERSION
    });
  }
}

// -------- helpers --------
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

function looksLikeJson(s) {
  if (!s) return false;
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}