// api/gs/tennis-odds.js
// Minimal health check για να δούμε αν τρέχει σωστά το function στο Vercel

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const hasToken = !!process.env.GOALSERVE_TOKEN;

    res.status(200).json({
      ok: true,
      message: 'tennis-odds healthcheck',
      hasToken,
      envKeys: Object.keys(process.env || {}).filter((k) =>
        k.toUpperCase().includes('GOALSERVE')
      ),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
};