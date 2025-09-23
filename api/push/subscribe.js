'use strict';

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // echo για διάγνωση
  const isString = typeof req.body === 'string';
  let body = req.body;
  try { if (isString) body = JSON.parse(req.body); } catch (_) {}

  return res.status(200).json({
    ok: true,
    typeofBody: typeof req.body,
    body
  });
};