// api/gs/tennis-odds.js
// Vercel Serverless Function: GoalServe tennis odds feed proxy (cat=tennis_10)
// Returns { ok:true, data, meta } envelope

import zlib from "zlib";
import { parseStringPromise } from "xml2js";

const READ_TIMEOUT_MS = 12000;

function withTimeout(ms) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ms);
  return { ctl, to };
}

async function fetchBuffer(url) {
  const { ctl, to } = withTimeout(READ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctl.signal,
      headers: {
        Accept: "application/xml,text/xml,application/json,text/plain,*/*",
        "Accept-Encoding": "gzip,deflate",
      },
    });

    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);

    return {
      ok: res.ok,
      status: res.status,
      headers: {
        encoding: res.headers.get("content-encoding") || "",
        contentType: res.headers.get("content-type") || "",
      },
      buf,
    };
  } finally {
    clearTimeout(to);
  }
}

function maybeGunzip(buf, encoding) {
  const enc = String(encoding || "").toLowerCase();
  if (enc.includes("gzip")) {
    try {
      return zlib.gunzipSync(buf);
    } catch {
      // If decompression fails, fall back to raw buffer
      return buf;
    }
  }
  return buf;
}

async function parseMaybeXmlOrJson(text) {
  // Try JSON first
  try {
    const j = JSON.parse(text);
    if (j && typeof j === "object") return j;
  } catch {
    // ignore
  }

  // Then XML
  try {
    const obj = await parseStringPromise(text, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const build = "odds-v1";
  const tzOffsetMinutes = new Date().getTimezoneOffset();

  try {
    const key = process.env.GOALSERVE_KEY;
    if (!key) {
      res.status(500).json({ ok: false, error: "missing_GOALSERVE_KEY" });
      return;
    }

    // Official GoalServe odds feed for tennis
    // Source: GoalServe file (“Odds comparison … getodds/soccer?cat=tennis_10”).  [oai_citation:1‡15.12 API feeds_urls 7.txt](sediment://file_00000000ba90722f801140067bffc4b8)
    const url = `https://www.goalserve.com/getfeed/${key}/getodds/soccer?cat=tennis_10`;

    const r = await fetchBuffer(url);
    const buf = maybeGunzip(r.buf, r.headers.encoding);
    const text = buf.toString("utf8");

    const data = await parseMaybeXmlOrJson(text);

    if (!r.ok || !data) {
      res.status(200).json({
        ok: false,
        error: !r.ok ? "upstream_not_ok" : "parse_failed",
        meta: {
          build,
          tzOffsetMinutes,
          upstreamStatus: r.status,
          upstreamEncoding: r.headers.encoding,
          upstreamContentType: r.headers.contentType,
          now: Date.now(),
        },
        debug: req.query?.debug ? { sample: text.slice(0, 400) } : undefined,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      cached: false,
      stale: false,
      ts: Date.now(),
      data,
      meta: {
        build,
        tzOffsetMinutes,
        upstreamStatus: r.status,
        upstreamEncoding: r.headers.encoding,
        upstreamContentType: r.headers.contentType,
        now: Date.now(),
      },
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      error: "odds_handler_failed",
      message: err?.message || "unknown_error",
      meta: { build, tzOffsetMinutes, now: Date.now() },
    });
  }
}