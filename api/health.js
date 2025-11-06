// api/health.js
// Lightweight diagnostics for LBQ proxy → GAS

module.exports = async (req, res) => {
  const GAS_URL = process.env.LBQ_GAS_URL || '';
  const SECRET  = process.env.LBQ_SECRET  || '';

  const out = {
    ok: true,
    env: {
      LBQ_GAS_URL: GAS_URL ? (GAS_URL.endsWith('/exec') ? 'present+/exec' : 'present-no-/exec') : 'missing',
      LBQ_SECRET: SECRET ? 'present' : 'missing',
    },
    checks: {},
  };

  if (!GAS_URL || !SECRET) {
    out.ok = false;
    return res.status(200).json(out);
  }

  // 1) doGet() – config ping
  try {
    const r = await fetch(GAS_URL, { method: 'GET' });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) } }
    out.checks.get = { status: r.status, ok: r.ok, data };
  } catch (e) {
    out.ok = false;
    out.checks.get = { error: String(e) };
  }

  // 2) doPost() – probe write (γράφει μικρό row)
  try {
    const probePayload = {
      secret: SECRET,
      source: 'health-probe',
      version: 'v5.0-phase1',
      event: 'probe',
      matchId: `probe-${Date.now()}`,
      playerA: 'Probe A',
      playerB: 'Probe B',
      ev: 0.01,
      confidence: 0.51,
      odds: 1.50,
      sets: '0-0',
      tip: 'AVOID',
      surface: 'hard',
      drift: 0,
      momentum: 0,
      form: 0,
      _generatedAt: new Date().toISOString()
    };
    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(probePayload)
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) } }
    out.checks.post = { status: r.status, ok: r.ok, data };
  } catch (e) {
    out.ok = false;
    out.checks.post = { error: String(e) };
  }

  return res.status(200).json(out);
};