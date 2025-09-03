import React, { useEffect, useMemo, useState, useRef } from "react";
import fetchTennisLive from "../utils/fetchTennisLive";
import analyzeMatch from "../utils/analyzeMatch";

const isUpcoming = (status) =>
  String(status || "").toLowerCase() === "not started";
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

function getSetFromStatus(status) {
  const str = String(status || "").toLowerCase();
  const m = str.match(/set\s*([1-5])/);
  if (m) return `SET ${m[1]}`;
  if (str.includes("1st")) return "SET 1";
  if (str.includes("2nd")) return "SET 2";
  if (str.includes("3rd")) return "SET 3";
  return null;
}

function currentSetFromScores(score) {
  const sets = score?.split?.(" ") || [];
  return sets.length ? `SET ${sets.length}` : null;
}

function LiveTennis() {
  const [matches, setMatches] = useState([]);
  const notifiedRef = useRef({});

  useEffect(() => {
    const load = async () => {
      const { matches } = await fetchTennisLive();
      setMatches(matches || []);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    const normalized = matches
      .filter((m) => !isFinishedLike(m.status))
      .map((match) => {
        const { label, ev, confidence, tip, note } = analyzeMatch(match);
        const isLive = !isUpcoming(match.status);
        const statusLower = (match.status || "").toLowerCase();
        const currentSet =
          getSetFromStatus(match.status) || currentSetFromScores(match.score) || null;

        let displayLabel = "";
        let sortPriority = 99;

        if (label) {
          displayLabel = label;
          sortPriority = {
            SAFE: 1,
            RISKY: 2,
            AVOID: 3,
          }[label] || 99;
        } else if (isLive && currentSet) {
          displayLabel = currentSet;
          sortPriority = 4;
        } else {
          displayLabel = "STARTS SOON";
          sortPriority = 5;
        }

        return {
          ...match,
          label: displayLabel,
          ev,
          confidence,
          tip,
          note,
          isLive,
          sortPriority,
        };
      });

    return normalized.sort((a, b) => a.sortPriority - b.sortPriority);
  }, [matches]);

  const playNotification = () => {
    const audio = new Audio("/notify.mp3");
    audio.play().catch(() => {});
  };

  useEffect(() => {
    filtered.forEach((m) => {
      if (m.label === "SAFE" && !notifiedRef.current[m.id]) {
        notifiedRef.current[m.id] = true;
        playNotification();
      }
    });
  }, [filtered]);

  return (
    <main style={{ paddingBottom: "40px" }}>
      {filtered.map((m) => {
        const { id, player1, player2, status, country, category, label, tip, isLive, note } = m;

        const labelColors = {
          SAFE: "#22c55e",
          RISKY: "#f59e0b",
          AVOID: "#ef4444",
          "SET 1": "#a855f7",
          "SET 2": "#a855f7",
          "SET 3": "#a855f7",
          "STARTS SOON": "#9ca3af",
        };

        return (
          <div
            key={id}
            style={{
              background: "#1e1e1e",
              borderRadius: 16,
              padding: 16,
              margin: "8px 16px",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    height: 10,
                    width: 10,
                    borderRadius: "50%",
                    background: isLive ? "#22c55e" : "#ef4444",
                    display: "inline-block",
                  }}
                />
                <strong>{player1} vs {player2}</strong>
              </div>
              <div
                style={{
                  background: labelColors[label] || "#6b7280",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "4px 10px",
                  fontWeight: "bold",
                  fontSize: 13,
                  minWidth: 80,
                  textAlign: "center",
                }}
              >
                {label}
              </div>
            </div>

            {tip && (
              <div style={{ color: "#22c55e", fontWeight: 500, fontSize: 14 }}>
                TIP: {tip}
              </div>
            )}

            <div style={{ fontSize: 13, color: "#d1d5db" }}>
              {m.date} • {category} • {country} • {status}
            </div>
          </div>
        );
      })}
    </main>
  );
}

export default LiveTennis;