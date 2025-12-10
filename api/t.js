// api/t.js
// Simple sink / echo endpoint used by share / t-links.
// Always returns 200 so the frontend never sees a 404.

export default async function handler(req, res) {
  try {
    const { query = {} } = req;

    res.status(200).json({
      ok: true,
      received: query,
    });
  } catch (e) {
    res.status(200).json({ ok: true });
  }
}