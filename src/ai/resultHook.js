// src/ai/feedHook.js

function webappUrl() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_WEBAPP_URL) return String(window.__LBQ_WEBAPP_URL);
    return String(process.env.REACT_APP_MODEL_URL || '');
  } catch {
    return '';
  }
}

function webappSecret() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_SECRET) return String(window.__LBQ_SECRET);
    return String(process.env.REACT_APP_LBQ_SECRET || '');
  } catch {
    return '';
  }
}

function buildUrlWithSecret(base, secret) {
  const hasQ = base.includes('?');
  const u = hasQ ? `${base}&event=result` : `${base}?event=result`;
  return secret ? `${u}&secret=${encodeURIComponent(secret)}` : u;
}

export async function LBQ_reportIfFinished({ matchId, status, winner, predicted }) {
  if (!matchId) return { ok: false, reason: 'no-id' };
  if (status !== 'finished') return { ok: false, reason: 'not-finished' };

  const result = winner && predicted ? (winner === predicted ? 'win' : 'loss') : 'loss';

  const url = buildUrlWithSecret(webappUrl(), webappSecret());
  if (!url) return { ok: false, reason: 'no-webapp-url' };

  const payload = {
    ts: new Date().toISOString(),
    sid: 'live-ui',
    model: 'v3.10',
    event: 'result',
    data: {
      matchId,
      result,
      winner,
      predicted
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: `http-${res.status}`, resp: j };
    return j || { ok: true };
  } catch {
    return { ok: false, reason: 'fetch-failed' };
  }
}

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = LBQ_reportIfFinished;
}