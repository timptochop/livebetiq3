// tools/goalserve_snapshot.js
// LOCKDOWN+ GoalServe probe: fetch multiple tennis feeds and print HARD facts.
// Usage (PowerShell):
//   $env:GOALSERVE_KEY="YOUR_KEY"
//   node tools/goalserve_snapshot.js
//
// Writes artifacts:
//   tools/_snap_headers.json
//   tools/_snap_body.bin
//   tools/_snap_text_preview.txt
//   tools/_snap_body_unzipped.bin (if gunzip works)

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function readDotEnvLocal() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, "utf8");
    for (const line of txt.split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const idx = s.indexOf("=");
      if (idx === -1) continue;
      const k = s.slice(0, idx).trim();
      const v = s
        .slice(idx + 1)
        .trim()
        .replace(/^"|"$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function headPreview(text, n = 1200) {
  const clean = String(text || "").replace(/\r/g, "");
  return clean.slice(0, n);
}

function tryGunzip(buf) {
  try {
    return zlib.gunzipSync(buf);
  } catch {
    return null;
  }
}

function countMatchesHeuristic(txt) {
  const s = String(txt || "");
  const m1 = (s.match(/<match\b/gi) || []).length;
  const m2 = (s.match(/<event\b/gi) || []).length;
  const m3 = (s.match(/"match"\s*:/gi) || []).length;
  const m4 = (s.match(/"matches"\s*:/gi) || []).length;
  const m5 = (s.match(/"event"\s*:/gi) || []).length;
  return {
    xml_match_tags: m1,
    xml_event_tags: m2,
    json_match_keys: m3,
    json_matches_keys: m4,
    json_event_keys: m5,
  };
}

async function fetchOnce(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "*/*",
      "user-agent": "livebetiq3-goalserve-snapshot/1.0",
      "accept-encoding": "gzip,deflate",
    },
  });

  const headers = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const ab = await res.arrayBuffer();
  const body = Buffer.from(ab);

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers,
    body,
  };
}

function safeText(buf) {
  try {
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

function keyMask(k) {
  if (!k) return "";
  if (k.length <= 10) return k;
  return `${k.slice(0, 6)}...${k.slice(-4)}`;
}

(async function run() {
  readDotEnvLocal();

  const KEY = String(
    process.env.GOALSERVE_KEY ||
      process.env.GS_KEY ||
      process.env.GOALSERVE_API_KEY ||
      ""
  ).trim();

  if (!KEY) {
    console.error(
      "[goalserve_snapshot] Missing GOALSERVE_KEY env. Set GOALSERVE_KEY=... or add it to .env.local"
    );
    process.exit(1);
  }

  const FEEDS = [
    {
      name: "tennis_scores/home?json=1",
      url: `https://www.goalserve.com/getfeed/${KEY}/tennis_scores/home?json=1`,
    },
    {
      name: "tennis_scores/d1?json=1",
      url: `https://www.goalserve.com/getfeed/${KEY}/tennis_scores/d1?json=1`,
    },
    {
      name: "tennis_scores/d-1?json=1",
      url: `https://www.goalserve.com/getfeed/${KEY}/tennis_scores/d-1?json=1`,
    },
    {
      name: "tennis_scores/home",
      url: `https://www.goalserve.com/getfeed/${KEY}/tennis_scores/home`,
    },
    {
      name: "tennis_scores/d1",
      url: `https://www.goalserve.com/getfeed/${KEY}/tennis_scores/d1`,
    },
    {
      name: "tennis_scores/d-1",
      url: `https://www.goalserve.com/getfeed/${KEY}/tennis_scores/d-1`,
    },
  ];

  const toolsDir = path.join(process.cwd(), "tools");
  ensureDir(toolsDir);

  console.log("------------------------------------------------------------");
  console.log("[goalserve_snapshot] START");
  console.log("[goalserve_snapshot] Using KEY:", keyMask(KEY));
  console.log("------------------------------------------------------------");

  for (const feed of FEEDS) {
    console.log(`\n[probe] ${feed.name}`);
    console.log(`URL: ${feed.url}`);

    let r;
    try {
      r = await fetchOnce(feed.url);
    } catch (e) {
      console.log("[probe] fetch ERROR:", e?.message || String(e));
      continue;
    }

    const ct = r.headers["content-type"] || "";
    const ce = r.headers["content-encoding"] || "";

    console.log(
      `[probe] status=${r.status} ok=${r.ok} content-type="${ct}" content-encoding="${ce}" bytes=${r.body.length}`
    );

    // overwrite artifacts each probe (simpler)
    fs.writeFileSync(path.join(toolsDir, "_snap_body.bin"), r.body);
    fs.writeFileSync(
      path.join(toolsDir, "_snap_headers.json"),
      JSON.stringify({ url: feed.url, ...r.headers }, null, 2)
    );

    let text = safeText(r.body);

    const gunz = tryGunzip(r.body);
    if (gunz && gunz.length > 0) {
      const t2 = safeText(gunz);
      // Prefer the "more structured" (usually unzipped)
      const score1 = (text.match(/[<{[]/g) || []).length;
      const score2 = (t2.match(/[<{[]/g) || []).length;
      if (score2 > score1) {
        text = t2;
        fs.writeFileSync(path.join(toolsDir, "_snap_body_unzipped.bin"), gunz);
        console.log("[probe] gunzip: SUCCESS (used unzipped text)");
      } else {
        console.log("[probe] gunzip: SUCCESS (kept original text)");
      }
    } else {
      console.log("[probe] gunzip: not used");
    }

    const preview = headPreview(text, 1200);
    fs.writeFileSync(
      path.join(toolsDir, "_snap_text_preview.txt"),
      preview,
      "utf8"
    );

    const counts = countMatchesHeuristic(text);
    console.log("[probe] heuristic counts:", counts);

    const trimmed = String(text || "").trim();
    const isHtml = /^<!doctype html/i.test(trimmed) || /<html/i.test(trimmed);
    const dataPresent =
      counts.xml_match_tags +
        counts.xml_event_tags +
        counts.json_match_keys +
        counts.json_matches_keys +
        counts.json_event_keys >
      0;

    console.log("[probe] preview (first 220 chars):");
    console.log(preview.slice(0, 220).replace(/\n/g, "\\n"));

    if (isHtml) console.log("[probe] NOTE: looks like HTML error/redirect.");
    console.log("[probe] DATA PRESENT:", dataPresent ? "YES" : "NO");
  }

  console.log("\n------------------------------------------------------------");
  console.log("[goalserve_snapshot] DONE");
  console.log("Artifacts written to:");
  console.log(" - tools/_snap_headers.json");
  console.log(" - tools/_snap_body.bin");
  console.log(" - tools/_snap_text_preview.txt");
  console.log("------------------------------------------------------------");
})().catch((e) => {
  console.error("[goalserve_snapshot] FATAL:", e?.message || String(e));
  process.exit(1);
});