// api/predictions.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const token = process.env.GOALSERVE_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Missing GOALSERVE_TOKEN in env' });
    }

    const url = `https://www.goalserve.com/getfeed/${token}/tennis?json=1`;
    const apiRes = await fetch(url, { cache: 'no-store' });

    if (!apiRes.ok) {
      throw new Error(`GoalServe HTTP ${apiRes.status}`);
    }

    const raw = await apiRes.json();

    // Normalize: matches must be an array
    const matches = Array.isArray(raw?.matches) ? raw.matches : [];

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ matches });
  } catch (err) {
    console.error('❌ /api/predictions failed:', err.message);
    // Fallback: empty matches list
    return res.status(200).json({ matches: [] });
  }
}