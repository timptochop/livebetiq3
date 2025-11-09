// api/lbqcc.js
export const config = { runtime: 'edge' };

const GAS_URL =
  process.env.LBQ_CONFIG_URL ||
  'https://script.google.com/macros/s/AKfycbz17GyM26w3U1YlejC1Ukq-yiBrN-UD5P1MN1tVHhrCv6IMBgfzE2-3y2E7v_96axs/exec';

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

async function safeJson(resp) {
  const txt = await resp.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: false, raw: txt };
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

  const urlIn = new URL(req.url);
  const qMode = (urlIn.searchParams.get('mode') || '').toLowerCase();
  const qOp = (urlIn.searchParams.get('op') || '').toLowerCase();
  const ts = urlIn.searchParams.get('ts') || '';

  try {
    if (req.method === 'GET') {
      if (qMode === 'ping') {
        return new Response(
          JSON.stringify({
            ok: true,
            via: 'get',
            data: {
              ok: true,
              webapi: 'v5.1.6-lockdown',
              sheet: 'LBQ Predictions',
              ts: new Date().toISOString(),
              config: { engine: 'v5', log_predictions: 1 },
            },
          }),
          { status: 200, headers: CORS }
        );
      }

      if (qMode === 'config') {
        const u = new URL(GAS_URL);
        u.searchParams.set('mode', 'config');
        if (ts) u.searchParams.set('ts', ts);
        const resp = await fetch(u.toString(), { cache: 'no-store' });
        const parsed = await safeJson(resp);
        const core = parsed?.data || parsed;
        const withCutoffs = ensureCutoffs(core);
        return new Response(
          JSON.stringify({ ok: true, via: 'get', fetchedAt: new Date().toISOString(), data: withCutoffs }),
          { status: 200, headers: CORS }
        );
      }

      if (qMode === 'learn' && (qOp === '' || qOp === 'preview')) {
        const u = new URL(GAS_URL);
        u.searchParams.set('mode', 'learn');
        u.searchParams.set('op', 'preview');
        if (ts) u.searchParams.set('ts', ts);
        const resp = await fetch(u.toString(), { cache: 'no-store' });
        const parsed = await safeJson(resp);
        const proposal =
          parsed?.proposal && typeof parsed.proposal === 'object'
            ? parsed.proposal
            : parsed?.data && typeof parsed.data === 'object'
            ? parsed.data
            : parsed;
        const withCutoffs = ensureCutoffs(proposal);
        return new Response(
          JSON.stringify({
            ok: true,
            via: 'get',
            mode: 'learn',
            op: 'preview',
            fetchedAt: new Date().toISOString(),
            proposal: withCutoffs,
            meta: parsed?.meta || null,
          }),
          { status: 200, headers: CORS }
        );
      }

      return new Response(JSON.stringify({ ok: true, via: 'get' }), { status: 200, headers: CORS });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const bMode = (body.mode || qMode || '').toLowerCase();
      const bOp = (body.op || qOp || '').toLowerCase();

      // --- FIX: όταν είναι learn/apply κάνε proxy στο GAS και ΕΠΕΣΤΡΕΨΕ το αποτέλεσμα (current/next)
      if (bMode === 'learn' && bOp === 'apply') {
        const payload = {
          mode: 'learn',
          op: 'apply',
          dryRun: body.dryRun ? 1 : 0,
          secret: body.secret || '',
          proposal: body.proposal || {},
        };

        const r = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const proxied = await safeJson(r);

        return new Response(
          JSON.stringify({
            ok: true,
            via: 'post',
            mode: 'learn',
            op: 'apply',
            result: proxied,
          }),
          { status: 200, headers: CORS }
        );
      }

      // κάθε άλλο POST: passthrough logging στον GAS endpoint
      const passthrough = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const proxied = await safeJson(passthrough);
      return new Response(JSON.stringify({ ok: true, via: 'post', proxied }), { status: 200, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), {
      status: 405,
      headers: CORS,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err), data: { ...DEFAULT_CUTOFFS } }), {
      status: 500,
      headers: CORS,
    });
  }
}