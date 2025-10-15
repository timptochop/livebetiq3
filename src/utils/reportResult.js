// src/utils/reportResult.js
export async function reportResult({ matchId, result, winner, predicted }) {
  if (!matchId) return { ok: false, error: 'missing matchId' };

  try {
    const resp = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, result, winner, predicted }),
    });
    const json = await resp.json().catch(() => ({}));
    return json;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}