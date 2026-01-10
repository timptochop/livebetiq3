// api/tennis-live.js
import fetch from "node-fetch";

function normalizeGuid(raw) {
  if (!raw) return null;
  const s = raw.replace(/[^a-fA-F0-9]/g, "");
  if (s.length !== 32) return null;
  return (
    s.slice(0, 8) + "-" +
    s.slice(8, 12) + "-" +
    s.slice(12, 16) + "-" +
    s.slice(16, 20) + "-" +
    s.slice(20)
  );
}

export default async function handler(req, res) {
  const rawKey =
    process.env.GOALSERVE_KEY ||
    process.env.GOALSERVE_TOKEN ||
    "";

  const guid = normalizeGuid(rawKey);

  if (!guid) {
    return res.status(500).json({
      ok: false,
      error: "INVALID_GOALSERVE_KEY",
      rawLen: rawKey.length,
    });
  }

  // ✅ CORRECT GoalServe endpoint
  const url =
    `https://www.goalserve.com/getfeed/tennis_scores/home?key=${guid}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "LiveBetIQ/1.0",
        "Accept": "application/xml",
      },
      timeout: 15000,
    });

    const text = await r.text();

    if (!text.trim().startsWith("<?xml")) {
      return res.status(502).json({
        ok: false,
        error: "UPSTREAM_NOT_XML",
        status: r.status,
        preview: text.slice(0, 300),
        url,
      });
    }

    return res.status(200).json({
      ok: true,
      guidUsed: guid,
      xmlPreview: text.slice(0, 500),
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "FETCH_FAILED",
      message: err.message,
    });
  }
}