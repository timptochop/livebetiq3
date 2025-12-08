// api/gs/tennis-odds.js
// v1.1 – GoalServe tennis odds proxy with gzip handling

const zlib = require('zlib');

const TOKEN = process.env.GOALSERVE_TOKEN || '';

/**
 * Safely gunzip if needed.
 * @param {Buffer} buf
 * @returns {string}
 */
function maybeGunzipToString(buf) {
  if (!buf || !buf.length) return '';
  // GZIP magic bytes: 0x1f 0x8b
  const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
  if (!isGzip) {
    return buf.toString('utf8');
  }

  try {
    const out = zlib.gunzipSync(buf);
    return out.toString('utf8');
  } catch (err) {
    // fallback: at least return latin1 so έχουμε κάτι να δούμε
    return buf.toString('latin1');
  }
}

/**
 * Build upstream URL for tennis odds feed.
 */
function buildOddsUrl() {
  if (!TOKEN) return null;
  // Από το feed_urls: getodds/soccer?cat=tennis_10&json=1
  return `https://www.goalserve.com/getfeed/${TOKEN}/getodds/soccer?cat=tennis_10&json=1`;
}

/**
 * Vercel Serverless handler
 */
module.exports = async function handler(req, res) {
  try {
    // 1) Healthcheck mode
    const health = req.query && req.query.health;
    if (health) {
      return res.status(200).json({
        ok: true,
        message: 'tennis-odds healthcheck',
        hasToken: Boolean(TOKEN),
        envKeys: ['GOALSERVE_TOKEN'],
      });
    }

    // 2) Basic env validation
    const url = buildOddsUrl();
    if (!url) {
      return res.status(500).json({
        ok: false,
        error: 'missing-goalserve-token',
      });
    }

    // 3) Fetch από GoalServe (αφήνουμε το Node fetch να κάνει ό,τι μπορεί μόνο του)
    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'GET',
        headers: {
          // δεν βάζουμε explicit Accept-Encoding, αφήνουμε το default
        },
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: 'fetch-failed',
        detail: String(err),
        url,
      });
    }

    // 4) Πάντα διαβάζουμε το σώμα ως Buffer και προσπαθούμε να κάνουμε gunzip
    let buf;
    try {
      const ab = await upstream.arrayBuffer();
      buf = Buffer.from(ab);
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: 'body-read-failed',
        detail: String(err),
        status: upstream.status,
        url,
      });
    }

    const text = maybeGunzipToString(buf);

    // Αν ο HTTP status ΔΕΝ είναι 2xx, επιστρέφουμε diagnostic JSON
    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: 'upstream-not-ok',
        status: upstream.status,
        url,
        bodySnippet: text.slice(0, 400),
      });
    }

    // 5) Προσπαθούμε να κάνουμε JSON parse (γιατί βάλαμε &json=1)
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: 'json-parse-failed',
        status: upstream.status,
        url,
        bodySnippet: text.slice(0, 400),
        detail: String(err),
      });
    }

    // 6) Προς το παρόν, γυρνάμε raw odds feed όπως είναι
    // Αργότερα θα φτιάξουμε κανονικό normalization (ανά matchId, market κλπ)
    return res.status(200).json({
      ok: true,
      source: 'goalserve-tennis-odds',
      url,
      raw: json,
    });
  } catch (err) {
    // Safety net – να ΜΗΝ ξαναδούμε το generic Vercel "This Serverless Function has crashed."
    return res.status(500).json({
      ok: false,
      error: 'handler-crashed',
      detail: String(err),
    });
  }
};