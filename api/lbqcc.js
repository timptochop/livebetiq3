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
    out.thrSafe =
      typeof out.safeConf === 'number'
        ? out.safeConf
        : typeof out.minSAFE === 'number'
        ? out.minSAFE
        : DEFAULT_CUTOFFS.thrSafe;
  }
  if (typeof out.thrRisky !== 'number') {
    out.thrRisky =
      typeof out.riskyConf === 'number'
        ? out.riskyConf
        : typeof out.minRISKY === 'number'
        ? out.minRISKY
        : DEFAULT_CUTOFFS.thrRisky;
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

  const urlIn = new URL(req.url);
  const mode = urlIn.searchParams.get('mode') || '';
  const ts = urlIn.searchParams.get('ts') || '';

  try {
    if (req.method === 'GET') {
      if (mode === 'ping') {
        return new Response(
          JSON.stringify({
            ok: true,
            via: 'get',
            data: {
              ok: true,
              webapi: 'v5.1-lockdown',
              sheet: 'LBQ Predictions',
              ts: new Date().toISOString(),
              config: { engine: 'v5', log_predictions: 1 },
            },
          }),
          { status: 200, headers: CORS }
        );
      }

      if (mode === 'config') {
        const u = new URL(GAS_URL);
        u.searchParams.set('mode', 'config');
        if (ts) u.searchParams.set('ts', ts);

        const resp = await fetch(u.toString(), { cache: 'no-store' });
        const raw = await resp.text();
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { ok: false, raw };
        }

        const core = parsed?.data || parsed;
        const withCutoffs = ensureCutoffs(core);

        return new Response(
          JSON.stringify({
            ok: true,
            via: 'get',
            fetchedAt: new Date().toISOString(),
            data: withCutoffs,
          }),
          { status: 200, headers: CORS }
        );
      }

      return new Response(JSON.stringify({ ok: true, via: 'get' }), { status: 200, headers: CORS });
    }

    if (req.method === 'POST') {
      const payload = await req.json();
      const r = await fetch(LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let proxied;
      try {
        proxied = JSON.parse(text);
      } catch {
        proxied = { ok: false, raw: text };
      }

      return new Response(JSON.stringify({ ok: true, via: 'post', proxied }), {
        status: 200,
        headers: CORS,
      });
    }

    return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), {
      status: 405,
      headers: CORS,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err), data: { ...DEFAULT_CUTOFFS } }),
      { status: 500, headers: CORS }
    );
  }
}