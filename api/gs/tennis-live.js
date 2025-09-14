// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Cache-Control', 'no-store');

  // Δεν κάνουμε throw ποτέ· πάντα καθαρό JSON
  const out = await fetchLiveTennis();
  // Για debug να ΜΗΝ παίρνεις FUNCTION_INVOCATION_FAILED
  return res.status(200).json(out);
}