// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState, useRef } from "react";
import fetchTennisLive from "../utils/fetchTennisLive";
import analyzeMatch from "../utils/analyzeMatch";

const isUpcoming = (s) => String(s || "").toLowerCase() === "not started";
const isFinishedLike = (s) => {
  const x = String(s || "").toLowerCase();
  return ["finished", "cancelled", "retired", "abandoned", "postponed", "walk over"].includes(x);
};
const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function setFromStatus(status) {
  const s = String(status || "");
  let m = s.match(/set\s*([1-5])/i);
  if (m) return parseInt(m[1]);
  if (/2nd/i.test(s)) return 2;
  if (/3rd/i.test(s)) return 3;
  if (/1st/i.test(s)) return 1;
  return null;
}

function currentSetFromScores(score1, score2) {
  const a = num(score1);
  const b = num(score2);
  if (a === null || b === null) return null;
  return Math.max(a, b);
}

export default function LiveTennis() {
  const [rows, setRows] = useState([]);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchTennisLive();
        const liveRows = (res?.matches || []).filter(
          (r) => !isFinishedLike(r?.status)
        );
        setRows(liveRows);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const matches = useMemo(() => {
    return rows.map((match) => {
      const setNum =
        setFromStatus(match.status) ||
        currentSetFromScores(match.score1, match.score2);

      const { label, ev, confidence, tip } =
        analyzeMatch(match, setNum) || {};

      let statusLabel = null;
      let color = null;

      if (label === "SAFE") {
        statusLabel = "SAFE";
        color = "green";
      } else if (label === "RISKY") {
        statusLabel = "RISKY";
        color = "orange";
      } else if (label === "AVOID") {
        statusLabel = "AVOID";
        color = "red";
      } else if (!isUpcoming(match.status)) {
        const s = setNum || 1;
        statusLabel = `SET ${s}`;
        color = "purple";
      } else {
        const mins = match.startsInMins || 0;
        statusLabel = `STARTS IN ${mins} MIN`;
        color = "gray";
      }

      return {
        ...match,
        label: statusLabel,
        labelColor: color,
        ev,
        confidence,
        tip,
        sortIndex: {
          SAFE: 1,
          RISKY: 2,
          AVOID: 3,
        }[label] || (isUpcoming(match.status) ? 5 : 4),
      };
    });
  }, [rows]);

  const sorted = useMemo(() => {
    return matches.sort((a, b) => a.sortIndex - b.sortIndex);
  }, [matches]);

  return (
    <main style={{ padding: "16px", paddingBottom: "80px", background: "#111", color: "#fff" }}>
      {sorted.map((m, i) => (
        <div
          key={i}
          style={{
            background: "#1a1a1a",
            marginBottom: "12px",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: isUpcoming(m.status) ? "red" : "limegreen",
              }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                {m.player1} vs {m.player2}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                {m.date} • {m.category}
              </div>
              {m.tip && (
                <div style={{ fontSize: "13px", color: "#9f9", marginTop: "4px" }}>
                  TIP: {m.tip}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              background: m.labelColor,
              color: "#fff",
              padding: "4px 12px",
              borderRadius: "999px",
              fontWeight: 700,
              fontSize: "13px",
              whiteSpace: "nowrap",
              minWidth: "88px",
              textAlign: "center",
            }}
          >
            {m.label}
          </div>
        </div>
      ))}
    </main>
  );
}