// tools/goalserve_probe.js
// Run: node tools/goalserve_probe.js
// Writes:
//   tools/_out_goalserve_headers.json
//   tools/_out_goalserve_text_preview.txt

import fs from "fs";
import zlib from "zlib";

const KEY = process.env.GOALSERVE_KEY || process.env.GOALSERVE_TOKEN || "";
if (!KEY) {
  console.error("Missing GOALSERVE_KEY or GOALSERVE_TOKEN in environment.");
  process.exit(1);
}

function toGuid32(raw32) {
  const s = String(raw32 || "").trim();
  if (s.length !== 32) return null;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const RAW = String(KEY).trim();
const GUID = toGuid32(RAW);

const KEYS = [
  { key: RAW, label: RAW.length === 32 ? "raw32" : `raw${RAW.length}` },
  ...(GUID ? [{ key: GUID, label: "guid32" }] : []),
];

const FEEDS = [
  { mode: "home", path: "tennis_scores/home?json=1" },
  { mode: "itf", path: "tennis_scores/itf?json=1" },
  { mode: "d1", path: "tennis_scores/d1?json=1" },
  { mode: "d2", path: "tennis_scores/d2?json=1" },
  { mode: "d-1", path: "tennis_scores/d-1?json=1" },
];

async function fetchOne(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json,application/xml,text/xml,text/plain,*/*",
      "Accept-Encoding": "gzip,deflate",
      "User-Agent": "livebetiq3/probe",
    },
  });

  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);

  const enc = (res.headers.get("content-encoding") || "").toLowerCase();
  let outBuf = buf;
  if (enc.includes("gzip")) {
    try {
      outBuf = zlib.gunzipSync(buf);
    } catch {
      outBuf = buf;
    }
  }

  const text = outBuf.toString("utf-8");
  const isHtml = /<html/i.test(text) || /<!doctype html/i.test(text);

  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type") || "",
    contentEncoding: res.headers.get("content-encoding") || "",
    isHtml,
    textPreview: text.slice(0, 2500),
  };
}

(async () => {
  const attempts = [];

  for (const k of KEYS) {
    for (const f of FEEDS) {
      for (const base of ["https://www.goalserve.com/getfeed", "http://www.goalserve.com/getfeed"]) {
        const url = `${base}/${k.key}/${f.path}`;
        console.log(`[TRY] key=${k.label} feed=${f.mode} -> ${url}`);

        try {
          const r = await fetchOne(url);
          attempts.push({ key: k.label, feed: f.mode, url, ...r });

          console.log(`      status=${r.status} ok=${r.ok} html=${r.isHtml} ct=${r.contentType}`);
          if (r.isHtml) console.log(`      HTML preview: ${r.textPreview.split("\n")[0]}`);
        } catch (e) {
          attempts.push({
            key: k.label,
            feed: f.mode,
            url,
            ok: false,
            status: 0,
            contentType: "",
            contentEncoding: "",
            isHtml: false,
            textPreview: "",
            error: e?.message || "unknown_error",
          });
          console.log(`      ERROR: ${e?.message || e}`);
        }
      }
    }
  }

  fs.writeFileSync("tools/_out_goalserve_headers.json", JSON.stringify({ attempts }, null, 2));
  fs.writeFileSync(
    "tools/_out_goalserve_text_preview.txt",
    attempts
      .map((a) => {
        return [
          `=== ${a.key} | ${a.feed} | status=${a.status} ok=${a.ok} html=${a.isHtml} ===`,
          a.url,
          a.textPreview || "",
          "",
        ].join("\n");
      })
      .join("\n")
  );

  console.log("Wrote tools/_out_goalserve_headers.json and tools/_out_goalserve_text_preview.txt");
})();