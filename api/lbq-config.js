// api/lbq-config.js

export const config = {
  runtime: 'edge',
};

const GAS_URL =
  process.env.LBQ_CONFIG_URL ||
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ ok: false, error: 'method-not-allowed' }),
      {
        status: 405,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    const upstream = await fetch(GAS_URL, {
      method: 'GET',
      headers: {
        'cache-control': 'no-cache',
      },
    });

    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        ok: false,
        error: 'invalid-json-from-gas',
        raw: text,
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
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        source: 'vercel-edge-proxy',
        error: String(err),
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}