// api/lbqcc.js
export const config = { runtime: 'edge' };

const GAS_URL =
  process.env.LBQ_CONFIG_URL ||
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

const LOG_URL = process.env.LOG_WEBHOOK_URL || GAS_URL;
const LBQ_SECRET = process.env.LBQ_SECRET || 'LBQ2025WebAPIProd!';

const DEFAULT_CUTOFFS = { thrSafe: 0.61, thrRisky: 0.4, minEV: 0.02 };
const DEFAULT_WEIGHTS = { ev: 0.3, confidence: 0.25, momentum: 0.15, drift: 0.1, surface: 0.1, form: 0.1 };

const LIMITS = {
  maxDelta: {
    ev: 0.05, confidence: 0.05, momentum: 0.05, drift: 0.05, surface: 0.05, form: 0.05,
    thrSafe: 0.03, thrRisky: 0.03, minEV: 0.02,
  },
  bounds: {
    ev: [0.0, 1.0], confidence: [0.0, 1.0], momentum: [0.0, 1.0],
    drift: [0.0, 1.0], surface: [0.0, 1.0], form: [0.0, 1.0],
    thrSafe: [0.50, 0.80], thrRisky: [0.30, 0.60], minEV: [0.00, 0.10],
  },
};

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

function pickWeights(src) {
  if (!src || typeof src !== 'object') return { ...DEFAULT_WEIGHTS, _source: 'defaults' };
  const w = {
    ev: typeof src.ev === 'number' ? src.ev : DEFAULT_WEIGHTS.ev,
    confidence: typeof src.confidence === 'number' ? src.confidence : DEFAULT_WEIGHTS.confidence,
    momentum: typeof src.momentum === 'number' ? src.momentum : DEFAULT_WEIGHTS.momentum,
    drift: typeof src.drift === 'number' ? src.drift : DEFAULT_WEIGHTS.drift,
    surface: typeof src.surface === 'number' ? src.surface : DEFAULT_WEIGHTS.surface,
    form: typeof src.form === 'number' ? src.form : DEFAULT_WEIGHTS.form,
  };
  return { ...w, _source: src._source || 'lbq-config' };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: CORS });
const nowISO = () => new Date().toISOString();

async function safeJson(resp) {
  const txt = await resp.text();
  try { return JSON.parse(txt); } catch { return { ok: false, raw: txt }; }
}

function clamp(x, [lo, hi]) { return Math.max(lo, Math.min(hi, x)); }

function validateProposal({ current, proposed }) {
  const violations = [];
  const out = { weights: {}, cutoffs: {} };

  for (const k of ['ev', 'confidence', 'momentum', 'drift', 'surface', 'form']) {
    const cur = current.weights[k];
    const prop = proposed.weights[k];
    const [lo, hi] = LIMITS.bounds[k];
    const maxD = LIMITS.maxDelta[k];
    if (typeof prop !== 'number' || Number.isNaN(prop)) { violations.push({ key: k, type: 'not-number', cur, prop }); out.weights[k] = cur; continue; }
    const clamped = clamp(prop, [lo, hi]);
    const delta = Math.abs(clamped - cur);
    out.weights[k] = delta > maxD ? cur + Math.sign(clamped - cur) * maxD : clamped;
    if (delta > maxD) violations.push({ key: k, type: 'delta', cur, prop: clamped, maxDelta: maxD });
  }

  for (const k of ['thrSafe', 'thrRisky', 'minEV']) {
    const cur = current.cutoffs[k];
    const prop = proposed.cutoffs[k];
    const [lo, hi] = LIMITS.bounds[k];
    const maxD = LIMITS.maxDelta[k];
    if (typeof prop !== 'number' || Number.isNaN(prop)) { violations.push({ key: k, type: 'not-number', cur, prop }); out.cutoffs[k] = cur; continue; }
    const clamped = clamp(prop, [lo, hi]);
    const delta = Math.abs(clamped - cur);
    out.cutoffs[k] = delta > maxD ? cur + Math.sign(clamped - cur) * maxD : clamped;
    if (delta > maxD) violations.push({ key: k, type: 'delta', cur, prop: clamped, maxDelta: maxD });
  }

  return { ok: violations.length === 0, violations, adjusted: out };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

  try {
    const urlIn = new URL(req.url);
    const mode = urlIn.searchParams.get('mode') || '';
    const op = urlIn.searchParams.get('op') || '';
    const ts = urlIn.searchParams.get('ts') || '';
    const dryRun = urlIn.searchParams.get('dryRun') || '';

    if (req.method === 'GET') {
      if (mode === 'ping') {
        return json(200, {
          ok: true,
          via: 'get',
          data: { webapi: 'v5.1.5-guardrails-dryrun', sheet: 'LBQ Predictions', ts: nowISO(), config: { engine: 'v5', log_predictions: 1 } },
        });
      }

      if (mode === 'config') {
        const u = new URL(GAS_URL);
        u.searchParams.set('mode', 'config');
        if (ts) u.searchParams.set('ts', ts);
        const parsed = await safeJson(await fetch(u.toString(), { cache: 'no-store' }));
        const core = parsed?.data || parsed;
        const cutoffs = ensureCutoffs(core);
        const weights = pickWeights(core);
        return json(200, { ok: true, via: 'get', fetchedAt: nowISO(), data: { ...weights, ...cutoffs, _source: core?._source || 'lbq-config' } });
      }

      if (mode === 'learn') {
        const u = new URL(GAS_URL);
        u.searchParams.set('mode', 'learn');
        u.searchParams.set('op', op || 'preview');
        if (ts) u.searchParams.set('ts', ts);
        const learnResp = await safeJson(await fetch(u.toString(), { cache: 'no-store' }));
        const proposalRaw =
          (learnResp?.proposal && typeof learnResp.proposal === 'object') ? learnResp.proposal :
          (learnResp?.data && typeof learnResp.data === 'object') ? learnResp.data : learnResp;

        const proposed = { weights: pickWeights(proposalRaw), cutoffs: ensureCutoffs(proposalRaw) };

        const cu = new URL(GAS_URL);
        cu.searchParams.set('mode', 'config');
        if (ts) cu.searchParams.set('ts', ts);
        const confResp = await safeJson(await fetch(cu.toString(), { cache: 'no-store' }));
        const core = confResp?.data || confResp;
        const current = { weights: pickWeights(core), cutoffs: ensureCutoffs(core) };

        if (op === 'apply') {
          if (!dryRun) return json(400, { ok: false, error: 'apply blocked: dryRun missing', code: 400 });
          const { ok, violations, adjusted } = validateProposal({ current, proposed });
          return json(200, {
            ok: true, via: 'get', mode: 'learn', op: 'apply', dryRun: true, fetchedAt: nowISO(),
            current, proposed, check: { ok, violations, adjusted }, note: 'Dry-run only. No write performed.',
          });
        }

        return json(200, {
          ok: true, via: 'get', mode: 'learn', op: 'preview', fetchedAt: nowISO(),
          proposal: { ...proposed.weights, ...proposed.cutoffs, _source: proposalRaw?._source || 'lbq-config' },
          meta: learnResp?.meta || null,
        });
      }

      return json(200, { ok: true, via: 'get' });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));

      if ((body?.mode === 'learn' && body?.op === 'apply')) {
        return json(403, { ok: false, error: 'apply disabled in v5.1.5 (dry-run only)', code: 403 });
      }

      const secret = String(body?.secret || '');
      if (!secret || secret !== LBQ_SECRET) {
        return json(401, { ok: false, error: 'Unauthorized: bad secret', code: 401 });
      }

      const passthrough = await fetch(LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const proxied = await safeJson(passthrough);
      return json(200, { ok: true, via: 'post', proxied });
    }

    return json(405, { ok: false, error: 'method-not-allowed' });
  } catch (err) {
    return json(500, { ok: false, error: String(err), data: { ...DEFAULT_CUTOFFS } });
  }
}