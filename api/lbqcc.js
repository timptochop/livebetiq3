// api/lbqcc.js

const FALLBACK_CONFIG = {
  SAFE_MIN_EV: 0.03,
  SAFE_MIN_CONF: 0.58,
  MAX_VOL_SAFE: 0.55,
  RISKY_MIN_EV: 0.01,
  RISKY_MIN_CONF: 0.53,
  MAX_VOL_RISKY: 0.9,
  MIN_ODDS: 1.3,
  MAX_ODDS: 7.5,
  LOG_PREDICTIONS: 1,
  ENGINE_VERSION: 'v3.3'
};

export default async function handler(req, res) {
  const ts = new Date().toISOString();
  const { method, query } = req;
  const mode = String(query.mode || '').toLowerCase();

  try {
    if (mode === 'ping') {
      return res.status(200).json({
        ok: true,
        via: 'local',
        webapi: 'v5.2-config-proxy',
        ts
      });
    }

    const GAS = process.env.LBQ_GAS_URL;
    if (!GAS) {
      if (mode === 'config') {
        return res.status(200).json({
          ok: true,
          webapi: 'v5.2-config-fallback-no-env',
          sheet: 'LBQ_Config',
          config: FALLBACK_CONFIG,
          warning: 'missing_env_LBQ_GAS_URL'
        });
      }
      return res
        .status(500)
        .json({ ok: false, error: 'missing_env_LBQ_GAS_URL' });
    }

    const url = new URL(GAS);
    for (const [k, v] of Object.entries(query || {})) {
      url.searchParams.set(k, String(v));
    }

    const controller = new AbortController();
    const timeoutMs = 8000;
    const to = setTimeout(() => controller.abort(), timeoutMs);

    let fetchOpts = { method, signal: controller.signal, headers: {} };

    if (method === 'POST') {
      const raw = await readRawBody(req);
      console.log(
        JSON.stringify({
          route: '/api/lbqcc',
          ts,
          method,
          url: url.toString(),
          rawLen: raw?.length || 0,
          rawHead: (raw || '').slice(0, 200)
        })
      );

      const ct = req.headers['content-type'] || 'application/json';
      fetchOpts.headers['content-type'] = ct;
      fetchOpts.body = raw || '{}';
    }

    let upstream;
    try {
      upstream = await fetch(url.toString(), fetchOpts);
    } finally {
      clearTimeout(to);
    }

    const text = await upstream.text();

    res.status(upstream.status || 200);
    res.setHeader(
      'content-type',
      upstream.headers.get('content-type') ||
        'application/json; charset=utf-8'
    );
    return res.send(text);
  } catch (e) {
    const aborted =
      e && (e.name === 'AbortError' || e.code === 'ABORT_ERR');
    const msg = e?.message || String(e);

    console.error(
      JSON.stringify({
        route: '/api/lbqcc',
        ts,
        error: aborted ? 'timeout' : 'exception',
        message: msg
      })
    );

    if (mode === 'config') {
      return res.status(200).json({
        ok: true,
        webapi: aborted
          ? 'v5.2-config-fallback-timeout'
          : 'v5.2-config-fallback-exception',
        sheet: 'LBQ_Config',
        config: FALLBACK_CONFIG,
        warning: aborted ? 'upstream-timeout' : 'upstream-exception',
        message: msg
      });
    }

    return res.status(aborted ? 504 : 500).json({
      ok: false,
      error: aborted ? 'timeout' : 'exception',
      message: msg
    });
  }
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    try {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data || '{}'));
      req.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}