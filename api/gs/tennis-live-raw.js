// api/gs/tennis-live-raw.js
import zlib from "zlib";

const BUILD_TAG = "v10.1.0-raw-upstream-inspector";

function looksLikeGzip(buf) {
  return buf && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function decodeUpstreamBody(buf, contentEncoding) {
  const enc = String(contentEncoding || "").toLowerCase();

  // Prefer magic-bytes over headers (headers can lie)
  if (looksLikeGzip(buf)) {
    try {
      return { text: zlib.gunzipSync(buf).toString("utf8"), used: "gzip(magic)" };
    } catch {}
  }

  if (enc.includes("br")) {
    try {
      return { text: zlib.brotliDecompressSync(buf).toString("utf8"), used: "br(header)" };
    } catch {}
  }

  if (enc.includes("deflate")) {
    try {
      return { text: zlib.inflateSync(buf).toString("utf8"), used: "deflate(header)" };
    } catch {}
  }

  if (enc.includes("gzip")) {
    try {
      return { text: zlib.gunzipSync(buf).toString("utf8"), used: "gzip(header)" };
    } catch {}
  }

  return { text: buf.toString("utf8"), used: "plain" };
}

export default async function handler(req, res) {
  try {
    const key = process.env.GOALSERVE_KEY;
    if (!key) {
      return res.status(500).json({ ok: false, error: "Missing GOALSERVE_KEY env var." });
    }

    const url = `https://www.goalserve.com/getfeed/${key}/tennis_scores/home`;

    const upstream = await fetch(url, {
      headers: {
        "user-agent": "livebetiq3/raw-inspector",
        accept: "application/xml,text/xml,*/*",
        "accept-encoding": "gzip,deflate,br",
      },
    });

    const ab = await upstream.arrayBuffer();
    const buf = Buffer.from(ab);

    const contentEncoding = upstream.headers.get("content-encoding") || "";
    const contentType = upstream.headers.get("content-type") || "";
    const { text, used } = decodeUpstreamBody(buf, contentEncoding);

    const limit = 4000;
    const preview = text.slice(0, limit);

    return res.status(200).json({
      ok: true,
      build: BUILD_TAG,
      upstream: {
        status: upstream.status,
        contentType,
        contentEncoding,
        contentLengthBytes: buf.length,
        decoderUsed: used,
      },
      raw: {
        startsWith: text.slice(0, 60),
        preview,
        previewLength: preview.length,
      },
      note:
        "This endpoint shows upstream XML (decoded) + headers. It is the closest safe view of GoalServe without exposing the key.",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Unhandled exception in tennis-live-raw inspector.",
      message: String(e?.message || e),
    });
  }
}