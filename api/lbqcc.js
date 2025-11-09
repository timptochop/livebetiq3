// api/lbqcc.js
// v5.1.7-forward — proxy to Google Apps Script (GAS) for learn/apply + config
// Requires ENV:
//   LBQ_GAS_URL   -> your deployed GAS /exec URL
//   LBQ_SECRET    -> "LBQ2025WebAPIProd!" (same as GAS SECRET)
// Optional:
//   LOG_WEBHOOK_URL -> if you want error webhook pings

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization'
};

const TIMEOUT_MS = 12000;

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
  const merged = { ...init, signal: ctrl.signal };
  return fetch(url, merged).finally(() => clearTimeout(id));
}

async function forwardGET(req) {
  const gas = process.env.LBQ_GAS_URL;
  if (!gas) return badConfig('LBQ_GAS_URL missing');

  // Preserve original querystring
  const u = new URL(req.url);
  const qs = u.search || '';

  const url = gas + qs;
  const r = await withTimeout(url, { method: 'GET' });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { ok: false, raw: txt }; }

  // Pass-through but annotated
  return json(r.status, { ok: true, via: 'get', proxied: true, data });
}

async function forwardPOST(req) {
  const gas = process.env.LBQ_GAS_URL;
  if (!gas) return badConfig('LBQ_GAS_URL missing');

  let body = {};
  try { body = await req.json(); } catch { body = {}; }

  // Ensure secret present; GAS will verify.
  if (!body.secret && process.env.LBQ_SECRET) {
    body.secret = process.env.LBQ_SECRET;
  }

  const r = await withTimeout(gas, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { ok: false, raw: txt }; }

  return json(r.status, { ok: true, via: 'post', proxied: true, ...data });
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const url = new URL(req.url);
    const mode = String(url.searchParams.get('mode') || '').toLowerCase();

    if (req.method === 'GET') {
      // ping/config/learn&preview → forward as-is
      return await forwardGET(req);
    }

    if (req.method === 'POST') {
      // learn/apply dryRun/commit → forward as-is
      return await forwardPOST(req);
    }

    return json(405, { ok: false, error: 'method-not-allowed' });
  } catch (err) {
    // Fallback (only if proxy fails)
    return json(500, {
      ok: false,
      error: 'proxy-failed',
      message: String(err),
      data: { status: 'logged', label: 'NA', ev: 0, confidence: 0 }
    });
  }
}