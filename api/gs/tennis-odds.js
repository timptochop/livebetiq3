// api/gs/tennis-odds.js
// Robust GoalServe tennis odds proxy with multi-endpoint fallback + safe JSON response

const READ_TIMEOUT_MS = 12000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickKey() {
  // Support multiple env names (keep compatibility)
  return (
    process.env.GOALSERVE_KEY ||
    process.env.GOALSERVE_API_KEY ||
    process.env.GOALSERVE_FEED_KEY ||
    process.env.GS_KEY ||
    ""
  ).trim();
}

async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/xml,text/xml,application/json,text/plain,*/*",
        "User-Agent": "livebetiq3-vercel/tennis-odds",
      },
      cache: "no-store",
      signal: ctl.signal,
    });

    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      encoding: res.headers.get("content-encoding") || "",
      text: text || "",
      url,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      encoding: "",
      text: "",
      url,
      error: err?.message || "fetch_failed",
    };
  } finally {
    clearTimeout(to);
  }
}

function looksLikeHtml(s) {
  const t = String(s || "").trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<title>");
}

function buildCandidateUrls(key) {
  // Important: GoalServe legacy feeds differ by account + product.
  // We try multiple known patterns. Whichever returns non-HTML and 200 wins.
  const baseA = "https://www.goalserve.com/getfeed";
  const baseB = "https://feed1.goalserve.com/80/getfeed";

  const paths = [
    "tennis_odds",       // what you used (some accounts support)
    "tennis_odds/home",  // common pattern for "home" feeds
    "tennis-odds",       // sometimes hyphenated (rare)
    "tennis-odds/home",
  ];

  const urls = [];
  for (const base of [baseA, baseB]) {
    for (const p of paths) {
      urls.push(`${base}/${key}/${p}`);
    }
  }
  return urls;
}

function safeSnippet(s, max = 800) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

export default async function handler(req, res) {
  const debug = String(req.query?.debug || "") === "1";
  const key = pickKey();

  if (!key) {
    return res.status(200).json({
      ok: false,
      error: "missing_key",
      meta: { build: "odds-v2", hint: "Set GOALSERVE_KEY (or GOALSERVE_API_KEY) in Vercel env." },
    });
  }

  const candidates = buildCandidateUrls(key);

  let last = null;
  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];

    const r = await fetchText(url);
    last = r;

    // Accept only successful non-HTML payloads
    if (r.ok && r.status === 200 && r.text && !looksLikeHtml(r.text)) {
      // Return raw feed text (XML) inside JSON so frontend can parse/index safely.
      return res.status(200).json({
        ok: true,
        sourceUrl: debug ? url : undefined,
        raw: r.text,
        meta: debug
          ? {
              build: "odds-v2",
              tried: i + 1,
              contentType: r.contentType,
              encoding: r.encoding,
              size: r.text.length,
            }
          : { build: "odds-v2" },
      });
    }

    // Small backoff between attempts
    await sleep(150);
  }

  // No candidate succeeded
  return res.status(200).json({
    ok: false,
    error: "upstream_not_ok",
    meta: {
      build: "odds-v2",
      tried: candidates.length,
      lastStatus: last?.status ?? null,
      lastContentType: last?.contentType ?? null,
      lastUrl: debug ? last?.url ?? null : undefined,
      note: "Upstream returned HTML or non-200. This usually means: wrong endpoint for your account OR odds feed not enabled.",
    },
    debug: debug
      ? {
          sample: safeSnippet(last?.text || "", 1200),
        }
      : undefined,
  });
}