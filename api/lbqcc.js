// api/lbqcc.js
// v5.1.7-hotfix — local ping + proxy to GAS for GET/POST

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization'
};

const TIMEOUT_MS = 8000; // πιο κάτω από το Vercel limit στο free tier

function json(status, obj, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...headers }
  });
}

function badConfig(msg) {
  return json(500, { ok: false, error: 'server-misconfig', note: msg });
}

function withTimeout(url, init, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort('timeout'), ms);
  const merged = { ...init, signal: ctrl.signal, cache: 'no-store', redirect: 'follow' };
  return fetch(url, merged).finally(() => clearTimeout(id));
}

async function forwardGET(req) {
  const gas = process.env.LBQ_GAS_URL;
  if (!gas) return badConfig('LBQ_GAS_URL missing');

  const u = new URL(req.url);
  const qs = u.search || '';
  const r = await withTimeout(gas + qs, { method: 'GET' });
  const txt = await r.text();
  let data; try { data = JSON.parse(txt); } catch { data = { ok: false, raw: txt }; }
  return json(r.status, { ok: true, via: 'get', proxied: true, data });
}

async function forwardPOST(req) {
  const gas = process.env.LBQ_GAS_URL;
  if (!gas) return badConfig('LBQ_GAS_URL missing');

  let body = {};
  try { body = await req.json(); } catch { body = {}; }

  if (!body.secret && process.env.LBQ_SECRET) body.secret = process.env.LBQ_SECRET;

  const r = await withTimeout(gas, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  const txt = await r.text();
  let data; try { data = JSON.parse(txt); } catch { data = { ok: false, raw: txt }; }
  return json(r.status, { ok: true, via: 'post', proxied: true, ...data });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const mode = String(url.searchParams.get('mode') || '').toLowerCase();

    // *** HOTFIX: local ping (χωρίς κλήση στο GAS) ***
    if (mode === 'ping') {
      return json(200, {
        ok: true,
        via: 'local',
        webapi: 'v5.1.7-hotfix',
        config: { engine: 'v5', log_predictions: 1 }
      });
    }

    if (req.method === 'GET') return await forwardGET(req);
    if (req.method === 'POST') return await forwardPOST(req);

    return json(405, { ok: false, error: 'method-not-allowed' });
  } catch (err) {
    return json(500, {
      ok: false,
      error: 'proxy-failed',
      message: String(err),
      data: { status: 'logged', label: 'NA', ev: 0, confidence: 0 }
    });
  }
}