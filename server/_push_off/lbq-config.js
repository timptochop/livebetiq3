// api/lbqcc.js
export const config = { runtime: 'edge' };

const GAS_URL =
  process.env.LBQ_CONFIG_URL ||
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

const LOG_URL = process.env.LOG_WEBHOOK_URL || GAS_URL;

const DEFAULT_CUTOFFS = { thrSafe: 0.61, thrRisky: 0.4, minEV: 0.02 };

function ensureCutoffs(obj) {
  if (!obj || typeof obj !== 'object') return { ...DEFAULT_CUTOFFS };
  const out = { ...obj };

  if (typeof out.thrSafe !== 'number') {
    if (typeof out.safeConf === 'number') out.thrSafe = out.safeConf;
    else if (typeof out.minSAFE === 'number') out.thrSafe = out.minSAFE;
    else out.thrSafe = DEFAULT_CUTOFFS.thrSafe;
  }
  if (typeof out.thrRisky !== 'number') {
    if (typeof out.riskyConf === 'number') out.thrRisky = out.riskyConf;
    else if (typeof out.minRISKY === 'number') out.thrRisky = out.minRISKY;
    else out.thrRisky = DEFAULT_CUTOFFS.thrRisky;
  }
  if (typeof out.minEV !== 'number') out.minEV = DEFAULT_CUTOFFS.minEV;
  return out;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

  try {
    if (req.method === 'GET') {
      const mode = req.nextUrl?.searchParams?.get('mode') || '';

      if (mode === 'ping') {
        return new Response(JSON.stringify({ ok: true, via: 'get', data: { ok: true, webapi: 'v5.1-lockdown', ts: new Date().toISOString(), config: { engine: 'v5', log_predictions: 1 } } }), { status: 200, headers: CORS });
      }

      if (mode === 'config') {
        const u = new URL(GAS_URL);
        u.searchParams.set('mode', 'config');
        const r = await fetch(u.toString());
        const raw = await r.text();
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = { ok: false, raw }; }

        const data = parsed && parsed.ok && parsed.data ? parsed.data : parsed;
        const withCutoffs = ensureCutoffs(data);
        return new Response(JSON.stringify({ ok: true, via: 'get', data: withCutoffs, fetchedAt: new Date().toISOString() }), { status: 200, headers: CORS });
      }

      return new Response(JSON.stringify({ ok: true, via: 'get' }), { status: 200, headers: CORS });
    }

    if (req.method === 'POST') {
      const payload = await req.json();
      const r = await fetch(LOG_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await r.text();
      let out; try { out = JSON.parse(body); } catch { out = { ok: false, raw: body }; }
      return new Response(JSON.stringify({ ok: true, via: 'post', proxied: out }), { status: 200, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), { status: 405, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err), data: { ...DEFAULT_CUTOFFS } }), { status: 500, headers: CORS });
  }
}