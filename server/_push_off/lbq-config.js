// api/lbq-config.js
// LBQ – EDGE proxy προς Google Apps Script για adaptive weights + SAFE/RISKY cutoffs
// Δεν μετράει στο όριο των 12 serverless στο Hobby.

export const config = {
  runtime: 'edge',
};

const GAS_URL =
  process.env.LBQ_CONFIG_URL ||
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

// default cutoffs αν το GAS δεν τα δώσει
const DEFAULT_CUTOFFS = {
  thrSafe: 0.61,
  thrRisky: 0.4,
  minEV: 0.02,
};

function ensureCutoffs(obj) {
  if (!obj || typeof obj !== 'object') {
    return { ...DEFAULT_CUTOFFS };
  }
  const out = { ...obj };

  if (typeof out.thrSafe !== 'number') {
    if (typeof out.safeConf === 'number') {
      out.thrSafe = out.safeConf;
    } else if (typeof out.minSAFE === 'number') {
      out.thrSafe = out.minSAFE;
    } else {
      out.thrSafe = DEFAULT_CUTOFFS.thrSafe;
    }
  }

  if (typeof out.thrRisky !== 'number') {
    if (typeof out.riskyConf === 'number') {
      out.thrRisky = out.riskyConf;
    } else if (typeof out.minRISKY === 'number') {
      out.thrRisky = out.minRISKY;
    } else {
      out.thrRisky = DEFAULT_CUTOFFS.thrRisky;
    }
  }

  if (typeof out.minEV !== 'number') {
    out.minEV = DEFAULT_CUTOFFS.minEV;
  }

  return out;
}

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(GAS_URL);
    const mode = req.nextUrl?.searchParams?.get('mode');
    if (mode) {
      url.searchParams.set('mode', mode);
    }

    const resp = await fetch(url.toString());
    const rawText = await resp.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parsed = {
        ok: false,
        error: 'invalid-json-from-gas',
        raw: rawText,
      };
    }

    // εδώ συμπληρώνουμε cutoffs ΠΡΙΝ τα στείλουμε στο frontend
    const withCutoffs = ensureCutoffs(parsed);

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'vercel-edge-proxy',
        fetchedAt: new Date().toISOString(),
        data: withCutoffs,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        source: 'vercel-edge-proxy',
        error: err?.message || 'fetch-failed',
        data: {
          // ακόμα και σε σφάλμα δώσε defaults για να μην σπάσει το modelClient
          ...DEFAULT_CUTOFFS,
        },
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}