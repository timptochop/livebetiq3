// Lightweight client telemetry (localStorage + CSV export)
const KEY = "__lbq_telemetry_v1__";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function writeAll(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {}
}

export function recordPrediction(evt) {
  // evt: { ts, matchId, p1, p2, label, prob, kelly, status, setNum, tip }
  const rows = readAll();
  rows.push(evt);
  writeAll(rows);
}

export function exportCSV(filename="lbq-telemetry.csv") {
  const rows = readAll();
  if (!rows.length) return;

  const heads = Object.keys(rows[0]);
  const csv = [
    heads.join(","),
    ...rows.map(r => heads.map(h => {
      const v = r[h] ?? "";
      const s = String(v).replaceAll('"','""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// helper
export function telemetrySummary() {
  const rows = readAll();
  const by = (k) => rows.filter(r => r.label === k).length;
  return {
    total: rows.length,
    SAFE: by("SAFE"),
    RISKY: by("RISKY"),
    AVOID: by("AVOID"),
  };
}

// expose for quick access in console
if (typeof window !== "undefined") {
  window.__LBQ = { exportCSV, telemetrySummary };
}