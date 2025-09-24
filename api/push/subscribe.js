export const config = { runtime: 'edge' };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const body = JSON.stringify({ ok: true, method: req.method });
  return new Response(body, { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
}