// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

let LAST_OK = null;
let LAST_OK_AT = 0;

const FRESH_TTL_MS = 60 * 1000;
const STALE_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const debug = req.query?.debug === '1';
  const now = Date.now();

  if (LAST_OK && now - LAST_OK_AT < FRESH_TTL_MS && !debug) {
    return res.status(200).json({ ...LAST_OK, meta: { ...(LAST_OK.meta || {}), cache: 'fresh' } });
  }

  try {
    const out = await fetchLiveTennis(debug);
    if (!out.error && Array.isArray(out.matches)) {
      LAST_OK = out;
      LAST_OK_AT = now;
      return res.status(200).json({ ...out, meta: { ...(out.meta || {}), cache: 'miss' } });
    }
    if (LAST_OK && now - LAST_OK_AT < STALE_TTL_MS) {
      return res.status(200).json({
        ...LAST_OK,
        meta: { ...(LAST_OK.meta || {}), cache: 'stale', upstreamError: out.error || 'unknown' }
      });
    }
    return res.status(200).json({ matches: [], error: out.error || 'Upstream unavailable', meta: { cache: 'none', ...(out.meta || {}) } });
  } catch {
    if (LAST_OK && now - LAST_OK_AT < STALE_TTL_MS) {
      return res.status(200).json({ ...LAST_OK, meta: { ...(LAST_OK.meta || {}), cache: 'stale', fatal: true } });
    }
    return res.status(200).json({ matches: [], error: 'Internal error', meta: { cache: 'none' } });
  }
}