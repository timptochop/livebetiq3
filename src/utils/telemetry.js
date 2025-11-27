// src/utils/telemetry.js

const LOG_REMOTE =
  String(process.env.REACT_APP_LOG_PREDICTIONS || '0') === '1';

function buildBodyFromPayload(p = {}) {
  const ts = p.ts || new Date().toISOString();

  const matchId = p.matchId || '';
  const label = p.label || '';
  const tip = p.tip || '';
  const prob = Number(p.prob || 0) || 0;
  const kelly = Number(p.kelly || 0) || 0;
  const status = p.status || '';
  const setNum =
    typeof p.setNum === 'number' ? p.setNum : p.setNum || null;

  const p1 = p.p1 || '';
  const p2 = p.p2 || '';

  const favName = p.favName || (p1 || '').toString();
  const favProb = prob;

  return {
    ts,
    sid: 'lbq-web-v3',
    model: 'ai-v3.10',
    event: 'prediction',
    data: {
      matchId,
      label,
      conf: prob,
      tip,
      features: {
        favName,
        favProb,
        kelly,
        status,
        setNum,
        p1,
        p2
      }
    }
  };
}

export function recordPrediction(payload = {}) {
  try {
    const body = buildBodyFromPayload(payload);

    console.log('[LBQ][Telemetry] prediction', body);

    if (!LOG_REMOTE) {
      return;
    }

    if (typeof fetch !== 'function') {
      return;
    }

    fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        console.log('[LBQ][Telemetry] result', data);
      })
      .catch((err) => {
        console.error('[LBQ][Telemetry] failed', err);
      });
  } catch (err) {
    console.error('[LBQ][Telemetry] error', err);
  }
}

window.lbqLogTestPrediction = function () {
  const now = new Date().toISOString();

  recordPrediction({
    ts: now,
    matchId: 'test-match-001',
    label: 'SAFE',
    prob: 0.88,
    tip: 'Player A wins',
    p1: 'Player A',
    p2: 'Player B',
    status: 'test',
    setNum: 2
  });
};