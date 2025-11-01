// api/lbq-config.js
// LBQ – EDGE proxy προς το Google Apps Script για adaptive weights
// Δεν μετράει στο όριο των 12 serverless στο Hobby.

export const config = {
  runtime: 'edge',
};

const GAS_URL =
  process.env.LBQ_CONFIG_URL ||
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

export default async function handler(req) {
  // basic CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resp = await fetch(GAS_URL);
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

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'vercel-edge-proxy',
        fetchedAt: new Date().toISOString(),
        data: parsed,
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