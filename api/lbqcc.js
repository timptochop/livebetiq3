// api/lbqcc.js
// v5.1.8-fastping — local ping + safe proxy to GAS (GET/POST) with timeout & raw body passthrough.

const VERSION = 'v5.1.8-fastping';

const GAS_URL = process.env.LBQ_GAS_URL;           // e.g. https://script.google.com/macros/s/XXXX/exec
const LBQ_SECRET = process.env.LBQ_SECRET || '';

/** Build a JSON response */
function sendJSON(res, code, obj) {
  res.status(code).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(obj));
}

/** Basic CORS (for tools/CLI; same-origin app δεν το χρειάζεται αλλά δεν βλάπτει) */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

/** Abortable fetch with timeout (ms) */
async function timedFetch(url, init = {}, ms = 4500) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error('timeout')), ms);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal });
    return r;
  } finally {
    clearTimeout(t);
  }
}

/** Compose GAS GET url with original QS */
function gasGetUrl(req) {
  const qs = req.url.includes('?') ? req.url.split('?')[1] : '';
  return qs ? `${GAS_URL}?${qs}` : GAS_URL;
}

export default async function handler(req, res) {
  setCORS(res);

  // Fast path for preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Safety checks
  if (!GAS_URL) {
    return sendJSON(res, 500, { ok: false, error: 'missing_GAS_URL', note: 'Set LBQ_GAS_URL in Vercel env.' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const mode = (url.searchParams.get('mode') || '').toLowerCase();

  // --- 1) Local fast ping (no network) ---
  if (req.method === 'GET' && mode === 'ping') {
    return sendJSON(res, 200, {
      ok: true,
      via: 'local',
      webapi: VERSION,
      ts: new Date().toISOString(),
    });
  }

  try {
    // --- 2) Proxy GET to GAS (config/learn preview etc.) ---
    if (req.method === 'GET') {
      const target = gasGetUrl(req);
      const gr = await timedFetch(target, { method: 'GET' }, 4500);
      const txt = await gr.text();
      // Try parse; if fails, wrap it
      try {
        const json = JSON.parse(txt);
        return sendJSON(res, gr.ok ? 200 : gr.status, json);
      } catch {
        return sendJSON(res, gr.ok ? 200 : gr.status, { ok: gr.ok, via: 'proxy:get', raw: txt });
      }
    }

    // --- 3) Proxy POST to GAS (raw-body passthrough) ---
    if (req.method === 'POST') {
      // Keep raw body exactly as received
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => resolve(data || '{}'));
        req.on('error', reject);
      });

      // Forward with application/json; Apps Script expects JSON string
      const target = gasGetUrl(req);
      const pr = await timedFetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      }, 4500);

      const txt = await pr.text();
      try {
        const json = JSON.parse(txt);
        return sendJSON(res, pr.ok ? 200 : pr.status, json);
      } catch {
        return sendJSON(res, pr.ok ? 200 : pr.status, { ok: pr.ok, via: 'proxy:post', raw: txt });
      }
    }

    // --- 4) Fallback ---
    return sendJSON(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (err) {
    const isTimeout = String(err && err.message || '').includes('timeout') || err?.name === 'AbortError';
    return sendJSON(res, isTimeout ? 504 : 502, {
      ok: false,
      code: isTimeout ? 'FUNCTION_INVOCATION_TIMEOUT' : 'FUNCTION_UPSTREAM_ERROR',
      message: String(err && err.message || err),
      webapi: VERSION,
    });
  }
}