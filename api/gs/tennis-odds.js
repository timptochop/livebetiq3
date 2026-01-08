// api/gs/tennis-odds.js
import zlib from "zlib";

const ODDS_URL = `https://www.goalserve.com/getfeed/${process.env.GOALSERVE_KEY}/tennis_odds`;

async function fetchWithGunzip(url) {
  const res = await fetch(url, {
    headers: {
      "Accept": "*/*",
      "User-Agent": "livebetiq/1.0",
    },
  });

  const buf = Buffer.from(await res.arrayBuffer());

  const encoding = res.headers.get("content-encoding") || "";
  const contentType = res.headers.get("content-type") || "";

  let text;
  try {
    if (encoding.includes("gzip")) {
      text = zlib.gunzipSync(buf).toString("utf-8");
    } else {
      text = buf.toString("utf-8");
    }
  } catch (e) {
    return {
      ok: false,
      error: "gunzip_failed",
      meta: { encoding, contentType },
    };
  }

  return {
    ok: true,
    status: res.status,
    encoding,
    contentType,
    text,
  };
}

export default async function handler(req, res) {
  const debug = String(req.query?.debug || "") === "1";

  try {
    const upstream = await fetchWithGunzip(ODDS_URL);

    if (!upstream.ok) {
      return res.status(200).json({
        ok: false,
        error: "upstream_decode_failed",
        meta: upstream.meta,
      });
    }

    // HARD GUARD: GoalServe sometimes returns HTML error pages
    if (!upstream.text.trim().startsWith("<")) {
      return res.status(200).json({
        ok: false,
        error: "upstream_not_xml",
        sample: upstream.text.slice(0, 200),
      });
    }

    // SUCCESS: return RAW XML for oddsParser
    return res.status(200).json({
      ok: true,
      raw: upstream.text,
      meta: debug
        ? {
            status: upstream.status,
            encoding: upstream.encoding,
            contentType: upstream.contentType,
            size: upstream.text.length,
          }
        : undefined,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "odds_handler_exception",
      message: err?.message,
    });
  }
}