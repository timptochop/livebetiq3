// tools/goalserve_probe.js
// Direct GoalServe upstream probe (CommonJS): prints status/headers and saves RAW body to file.
// Usage:
//   node tools/goalserve_probe.js "YOUR_GOALSERVE_KEY"
//
// Output:
//   - tools/_out_goalserve_headers.json
//   - tools/_out_goalserve_raw.bin
//   - tools/_out_goalserve_text_preview.txt (first 4000 chars)

const fs = require("fs");
const zlib = require("zlib");

const key = process.argv[2];
if (!key) {
  console.error('Missing key. Usage: node tools/goalserve_probe.js "YOUR_GOALSERVE_KEY"');
  process.exit(1);
}

const url = `https://www.goalserve.com/getfeed/${key}/tennis_scores/home`;

function looksLikeGzip(buf) {
  return buf && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function safeDecode(buf, encHeader) {
  const enc = String(encHeader || "").toLowerCase();

  // If body is gzipped (magic bytes), gunzip regardless of headers.
  if (looksLikeGzip(buf)) {
    try {
      return zlib.gunzipSync(buf).toString("utf8");
    } catch {}
  }

  // Respect header if present (best effort).
  if (enc.includes("br")) {
    try {
      return zlib.brotliDecompressSync(buf).toString("utf8");
    } catch {}
  }
  if (enc.includes("deflate")) {
    try {
      return zlib.inflateSync(buf).toString("utf8");
    } catch {}
  }
  if (enc.includes("gzip")) {
    try {
      return zlib.gunzipSync(buf).toString("utf8");
    } catch {}
  }

  // Fallback: plain text
  return buf.toString("utf8");
}

async function run() {
  console.log("[probe] GET", url);

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "livebetiq3/direct-goalserve-probe",
      accept: "application/xml,text/xml,*/*",
      "accept-encoding": "gzip,deflate,br",
    },
  });

  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);

  const headersObj = {};
  for (const [k, v] of r.headers.entries()) headersObj[k] = v;

  const outHeaders = {
    url,
    status: r.status,
    ok: r.ok,
    contentType: r.headers.get("content-type") || null,
    contentEncoding: r.headers.get("content-encoding") || null,
    contentLength: r.headers.get("content-length") || null,
    headers: headersObj,
    bytes: buf.length,
  };

  fs.mkdirSync("tools", { recursive: true });
  fs.writeFileSync("tools/_out_goalserve_headers.json", JSON.stringify(outHeaders, null, 2));
  fs.writeFileSync("tools/_out_goalserve_raw.bin", buf);

  const text = safeDecode(buf, r.headers.get("content-encoding"));
  const preview = text.slice(0, 4000);
  fs.writeFileSync("tools/_out_goalserve_text_preview.txt", preview);

  console.log("[probe] status:", outHeaders.status);
  console.log("[probe] content-type:", outHeaders.contentType);
  console.log("[probe] content-encoding:", outHeaders.contentEncoding);
  console.log("[probe] bytes:", outHeaders.bytes);
  console.log("[probe] preview (first 400 chars):");
  console.log(preview.slice(0, 400));
}

run().catch((e) => {
  console.error("[probe] FAILED:", e?.message || e);
  process.exit(1);
});