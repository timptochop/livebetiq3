// api/health.js
module.exports = async (req, res) => {
  res.status(200).json({ ok: true });
};