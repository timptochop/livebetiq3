import { fetchPredictions } from '../_lib/goalServeLiveAPI';

export default async function handler(req, res) {
  try {
    const data = await fetchPredictions();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'pred_failed', message: err?.message || 'unknown_error' });
  }
}