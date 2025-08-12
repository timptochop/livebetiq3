// api/telemetry.js
// Serverless function στο Vercel για health check (GET)
// και απλή λήψη telemetry payloads (POST).

export default async function handler(req, res) {
  // GET => health/info
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      env: 'vercel',
      time: new Date().toISOString(),
      region: process.env.VERCEL_REGION || null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    });
  }

  // POST => δέχεται JSON telemetry
  if (req.method === 'POST') {
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};

      // Θα φαίνεται στα Vercel function logs (Deployment → Functions)
      console.log('[telemetry]', body);

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }
  }

  // Άλλες μέθοδοι δεν επιτρέπονται
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}