// api/gs/tennis-odds.js
// v1.2 – GoalServe tennis odds proxy with gzip handling + soft errors

const zlib = require("zlib");

const TOKEN = process.env.GOALSERVE_TOKEN || "";

function maybeGunzipToString(buf) {
  if (!buf || !buf.length) return "";
  const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
  if (!isGzip) {
    return buf.toString("utf8");
  }

  try {
    const out = zlib.gunzipSync(buf);
    return out.toString("utf8");
  } catch (err) {
    return buf.toString("latin1");
  }
}

function buildOddsUrl() {
  if (!TOKEN) return null;
  return `https://www.goalserve.com/getfeed/${TOKEN}/getodds/soccer?cat=tennis_10&json=1`;
}

function softError(res, code, extra = {}) {
  return res.status(200).json({
    ok: false,
    error: code,
    ...extra,
  });
}

module.exports = async function handler(req, res) {
  try {
    const health = req.query && req.query.health;
    if (health) {
      return res.status(200).json({
        ok: true,
        message: "tennis-odds healthcheck",
        hasToken: Boolean(TOKEN),
        envKeys: ["GOALSERVE_TOKEN"],
      });
    }

    const url = buildOddsUrl();
    if (!url) {
      return softError(res, "missing-goalserve-token");
    }

    let upstream;
    try {
      upstream = await fetch(url, {
        method: "GET",
      });
    } catch (err) {
      return softError(res, "fetch-failed", {
        detail: String(err),
        url,
      });
    }

    let buf;
    try {
      const ab = await upstream.arrayBuffer();
      buf = Buffer.from(ab);
    } catch (err) {
      return softError(res, "body-read-failed", {
        detail: String(err),
        status: upstream.status,
        url,
      });
    }

    const text = maybeGunzipToString(buf);

    if (!upstream.ok) {
      return softError(res, "upstream-not-ok", {
        status: upstream.status,
        url,
        bodySnippet: text.slice(0, 400),
      });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      return softError(res, "json-parse-failed", {
        status: upstream.status,
        url,
        bodySnippet: text.slice(0, 400),
        detail: String(err),
      });
    }

    return res.status(200).json({
      ok: true,
      source: "goalserve-tennis-odds",
      url,
      raw: json,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "handler-crashed",
      detail: String(err),
    });
  }
};