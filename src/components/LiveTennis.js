// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState, useRef } from "react";
import fetchTennisLive from "../utils/fetchTennisLive";
import analyzeMatch from "../utils/analyzeMatch";

// ... [όλα τα helpers όπως στο δικό σου]

export default function LiveTennis({ onLiveCount = () => {}, notificationsOn = true }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const notifiedRef = useRef(new Set());

  const playNotify = () => {
    try {
      const audio = new Audio("/notify.mp3");
      audio.play().catch(() => {});
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const normalized = useMemo(() => {
    return rows.map((m) => {
      const players = Array.isArray(m.players) ? m.players : Array.isArray(m.player) ? m.player : [];
      const p1 = players[0] || {};
      const p2 = players[1] || {};
      const name1 = p1.name || p1["@name"] || "";
      const name2 = p2.name || p2["@name"] || "";
      const date = m.date || m["@date"] || "";
      const time = m.time || m["@time"] || "";
      const dt = parseDateTime(date, time);
      const status = m.status || m["@status"] || "";
      const setByStatus = setFromStatus(status);
      const setByScores = currentSetFromScores(players);
      const setNum = setByStatus || setByScores || (isUpcoming(status) ? 1 : null);
      const isLive = !isUpcoming(status) && !isFinishedLike(status);

      const ai = analyzeMatch(m); // your full logic
      const { label, confidence, reason } = ai || {};

      return {
        id: m.id || m["@id"] || `${date}-${time}-${name1}-${name2}`,
        name1, name2, date, time, dt, status, setNum, isLive,
        categoryName: m.categoryName || m["@category"] || m.category || "",
        label, confidence, reason
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const visible = normalized.filter((m) => !isFinishedLike(m.status));

    visible.forEach((m) => {
      if (notificationsOn && m.label === "SAFE" && m.confidence > 60 && !notifiedRef.current.has(m.id)) {
        notifiedRef.current.add(m.id);
        console.log("🔔 SAFE:", m.name1, "vs", m.name2);
        playNotify();
      }
    });

    return visible;
  }, [normalized, notificationsOn]);

  useEffect(() => {
    onLiveCount(filtered.filter(x => x.isLive).length);
  }, [filtered, onLiveCount]);

  const titleStyle = { fontSize: 16, fontWeight: 800, color: "#f2f6f9", lineHeight: 1.12 };
  const detailsStyle = { marginTop: 6, fontSize: 12, color: "#c7d1dc", lineHeight: 1.35 };
  const reasonStyle = { marginTop: 8, fontSize: 11, color: "#8893a0", fontStyle: "italic" };

  const setBadge = (m) => {
    if (!m.setNum) return null;
    return (
      <div style={{
        background: "#5f4abf",
        color: "#fff",
        borderRadius: 16,
        padding: "6px 12px",
        fontWeight: 900,
        fontSize: 13,
        minWidth: 64,
        textAlign: "center"
      }}>
        SET {m.setNum}
      </div>
    );
  };

  const labelBadge = (m) => {
    const colors = {
      SAFE: "#1fdd73",
      RISKY: "#f4bd00",
      AVOID: "#e14d4d",
      PENDING: "#9c6bff"
    };
    if (!m.label) return null;
    const bg = colors[m.label] || "#999";
    return (
      <div style={{
        background: bg,
        color: "#0a0c0e",
        borderRadius: 14,
        padding: "6px 12px",
        fontWeight: 800,
        fontSize: 13,
        textTransform: "uppercase"
      }}>
        {m.label}
      </div>
    );
  };

  return (
    <div style={{ background: "#0a0c0e", minHeight: "100vh", padding: "80px 16px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {filtered.map((m) => (
          <div key={m.id} style={{
            borderRadius: 18,
            background: "#121416",
            border: "1px solid #1d2126",
            boxShadow: "0 14px 28px rgba(0,0,0,0.45)",
            padding: 16,
            marginBottom: 12,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span title={m.isLive ? "Live" : "Upcoming"} style={{
                  display: "inline-block",
                  width: 12, height: 12,
                  borderRadius: "50%",
                  background: m.isLive ? "#1fdd73" : "#ff5d5d",
                  boxShadow: m.isLive
                    ? "0 0 10px rgba(31,221,115,.8)"
                    : "0 0 8px rgba(255,93,93,.6)",
                }}/>
                <div>
                  <div style={titleStyle}>
                    {m.name1} <span style={{ color: "#96a5b4", fontWeight: 600 }}>vs</span> {m.name2}
                  </div>
                  <div style={detailsStyle}>
                    {m.date} {m.time} • {m.categoryName}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {setBadge(m)}
                {labelBadge(m)}
              </div>
            </div>
            {m.reason && (
              <div style={reasonStyle}>
                {m.reason}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 12,
            background: "#121416",
            border: "1px solid #22272c",
            color: "#c7d1dc",
            fontSize: 13,
          }}>
            No matches found (live or upcoming).
          </div>
        )}
      </div>
    </div>
  );
}