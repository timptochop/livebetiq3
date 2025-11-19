const KEY = "__lbq_telemetry_v1__";

const WEBAPI_URL = process.env.LBQ_WEBAPI_URL;
const WEBAPI_SECRET = process.env.LBQ_WEBAPI_SECRET || "LBQ2025WebAPIProd!";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
}

async function sendToWebApi(evt) {
  try {
    if (typeof fetch === "undefined") return;
    if (!WEBAPI_URL) return;

    const timestamp = evt.ts || new Date().toISOString();
    const matchId = evt.matchId || evt.id || "unknown";
    const players = [evt.p1, evt.p2].filter(Boolean).join(" vs ");

    const ev =
      typeof evt.ev === "number"
        ? evt.ev
        : undefined;

    const confidence =
      typeof evt.conf === "number"
        ? evt.conf
        : typeof evt.prob === "number"
        ? evt.prob
        : undefined;

    const kelly =
      typeof evt.kelly === "number"
        ? evt.kelly
        : undefined;

    const label = evt.label || evt.status || "NA";
    const note = evt.tip || "";

    const payload = {
      secret: WEBAPI_SECRET,
      timestamp,
      matchId,
      players,
      ev,
      confidence,
      kelly,
      label,
      note,
      engine: evt.engine || "v5",
      raw: evt
    };

    const url = WEBAPI_URL + "?secret=" + encodeURIComponent(WEBAPI_SECRET);

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
  }
}

export function recordPrediction(evt) {
  const rows = readAll();
  rows.push(evt);
  writeAll(rows);
  try {
    sendToWebApi(evt);
  } catch {}
}

export function exportCSV(filename = "lbq-telemetry.csv") {
  const rows = readAll();
  if (!rows.length) return;

  const heads = Object.keys(rows[0]);
  const csv = [
    heads.join(","),
    ...rows.map((r) =>
      heads
        .map((h) => {
          const v = r[h] ?? "";
          const s = String(v).replaceAll('"', '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function telemetrySummary() {
  const rows = readAll();
  const by = (k) => rows.filter((r) => r.label === k).length;
  return {
    total: rows.length,
    SAFE: by("SAFE"),
    RISKY: by("RISKY"),
    AVOID: by("AVOID")
  };
}

if (typeof window !== "undefined") {
  window.__LBQ = { exportCSV, telemetrySummary };
}