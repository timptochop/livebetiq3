// src/components/LiveTennis.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import fetchTennisLive from "../utils/fetchTennisLive";
import fetchTennisOdds from "../utils/fetchTennisOdds";
import buildOddsIndex from "../utils/oddsParser";
import { trackOdds, getDrift } from "../utils/oddsTracker";
import analyzeMatch from "../utils/analyzeMatch";
import { showToast } from "../utils/toast";
import useLiveCount from "../hooks/useLiveCount";
import {
  logPrediction,
  addPending,
  trySettleFinished,
} from "../utils/predictionLogger";
import { maybeLogResult } from "../ai/autoLogger";
import { ingestBatch } from "../ai/adaptTuner";

const FINISHED = new Set([
  "finished",
  "cancelled",
  "retired",
  "abandoned",
  "postponed",
  "walk over",
]);

const isFinishedLike = (s) => FINISHED.has(String(s || "").toLowerCase());
const isUpcoming = (s) => String(s || "").toLowerCase() === "not started";

const toInt = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {};
  const b = p[1] || {};
  const sA = [toInt(a.s1), toInt(a.s2), toInt(a.s3), toInt(a.s4), toInt(a.s5)];
  const sB = [toInt(b.s1), toInt(b.s2), toInt(b.s3), toInt(b.s4), toInt(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) {
    if (sA[i] !== null || sB[i] !== null) k = i + 1;
  }
  return k || 0;
}

function parseStart(dateStr, timeStr) {
  const d = String(dateStr || "").trim();
  const t = String(timeStr || "").trim();
  if (!d || !t) return null;

  const dtA = new Date(`${d}T${t}`);
  if (Number.isFinite(dtA.getTime())) return dtA;

  const dtB = new Date(`${d} ${t}`);
  return Number.isFinite(dtB.getTime()) ? dtB : null;
}

function formatDiff(ms) {
  if (ms <= 0) return "any minute";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

async function tryTg(text) {
  try {
    await fetch("/api/tg?text=" + encodeURIComponent(text));
  } catch {
    // ignore
  }
}

const labelPriority = {
  SAFE: 1,
  RISKY: 2,
  AVOID: 3,
  "SET 3": 4,
  "SET 2": 5,
  "SET 1": 6,
  UPCOMING: 7,
};

export default function LiveTennis({
  onLiveCount = () => {},
  notificationsOn = true,
  audioOn = true,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastLabelRef = useRef(new Map());

  async function load() {
    setLoading(true);
    try {
      // Fetch scores + odds in parallel
      const [base, oddsRaw] = await Promise.all([
        fetchTennisLive(),
        fetchTennisOdds().catch(() => null),
      ]);

      const oddsIndex =
        oddsRaw && typeof oddsRaw === "object"
          ? buildOddsIndex({ raw: oddsRaw }) || {}
          : {};

      const keep = (Array.isArray(base) ? base : []).filter(
        (m) => !isFinishedLike(m.status || m["@status"])
      );
      const now = Date.now();

      const enriched = keep.map((m, idx) => {
        const players = Array.isArray(m.players)
          ? m.players
          : Array.isArray(m.player)
          ? m.player
          : [];
        const p1 = players[0] || {};
        const p2 = players[1] || {};
        const name1 = p1.name || p1["@name"] || "";
        const name2 = p2.name || p2["@name"] || "";
        const date = m.date || m["@date"] || "";
        const time = m.time || m["@time"] || "";
        const status = m.status || m["@status"] || "";
        const setNum = currentSetFromScores(players);

        // Stable matchId used also for odds join
        const matchId =
          m.id || m["@id"] || `${date}-${time}-${name1}-${name2}-${idx}`;

        // --- ODDS + DRIFT JOIN (safe fallbacks) ---
        const odds = oddsIndex && matchId ? oddsIndex[matchId] : null;

        let favOdds = null;
        let favImplied = null;
        let drift = 0;

        if (odds && Number(odds.favOdds) > 1) {
          const homeOdds = Number(odds.homeOdds) > 1 ? Number(odds.homeOdds) : null;
          const awayOdds = Number(odds.awayOdds) > 1 ? Number(odds.awayOdds) : null;
          const fav = Number(odds.favOdds);

          const invHome = homeOdds ? 1 / homeOdds : 0;
          const invAway = awayOdds ? 1 / awayOdds : 0;
          const invFav = 1 / fav;
          const denom = invHome + invAway;

          if (denom > 0 && Number.isFinite(invFav)) {
            favImplied = invFav / denom;
          }

          if (Number.isFinite(favImplied) && favImplied > 0 && favImplied < 1) {
            trackOdds(matchId, favImplied);
            drift = getDrift(matchId);
          }

          favOdds = fav;
        }

        const extraFeatures = {
          pOdds: favOdds,
          drift,
          favName: odds && odds.favName ? odds.favName : null,
        };

        const ai = analyzeMatch(m, extraFeatures) || {};

        let startAt = null;
        let startInMs = null;
        let startInText = null;
        if (isUpcoming(status)) {
          const dt = parseStart(date, time);
          if (dt) {
            startAt = dt.getTime();
            startInMs = startAt - now;
            startInText = formatDiff(startInMs);
          }
        }

        return {
          id: matchId,
          name1,
          name2,
          date,
          time,
          status,
          setNum,
          categoryName:
            m.categoryName || m["@category"] || m.category || "",
          ai,
          players,
          odds: odds || null,
          startAt,
          startInMs,
          startInText,
        };
      });

      setRows(enriched);
      ingestBatch(enriched);

      await Promise.allSettled(
        (Array.isArray(base) ? base : []).map((m) => maybeLogResult(m))
      );

      trySettleFinished(base);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => {
    const items = rows.map((m) => {
      const s = m.status || "";
      const live = !!s && !isUpcoming(s) && !isFinishedLike(s);
      let label = m.ai?.label || null;

      if (!live && isUpcoming(s)) {
        label = "UPCOMING";
      } else if (!label || label === "PENDING") {
        label = live ? `SET ${m.setNum || 1}` : "UPCOMING";
      }

      if (label && label.startsWith && label.startsWith("SET")) {
        const parts = label.split(/\s+/);
        const n = Number(parts[1]) || m.setNum || 1;
        label = `SET ${n}`;
      }

      return {
        ...m,
        live,
        uiLabel: label,
        order: labelPriority[label] || 99,
      };
    });

    return items.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;

      if (a.order >= 4 && a.order <= 6 && b.order >= 4 && b.order <= 6) {
        return a.order - b.order;
      }

      if (a.live && b.live) {
        return (b.setNum || 0) - (a.setNum || 0);
      }

      if (a.uiLabel === "UPCOMING" && b.uiLabel === "UPCOMING") {
        const ax = a.startAt || 0;
        const bx = b.startAt || 0;
        return ax - bx;
      }

      return 0;
    });
  }, [rows]);

  const liveList = useMemo(() => list.filter((m) => m.live), [list]);
  useLiveCount(liveList);

  useEffect(() => {
    onLiveCount(liveList.length);
  }, [liveList, onLiveCount]);

  useEffect(() => {
    list.forEach((m) => {
      const cur = m.uiLabel || null;
      const prev = lastLabelRef.current.get(m.id) || null;
      const isPred = cur === "SAFE" || cur === "RISKY" || cur === "AVOID";

      if (isPred && cur !== prev) {
        if (cur === "SAFE" && audioOn) {
          try {
            // fire-and-forget audio
            // eslint-disable-next-line no-new
            new Audio("/notify.mp3").play().catch(() => {});
          } catch {
            // ignore audio errors
          }
        }

        if (notificationsOn) {
          const t = `${cur}: ${m.name1} vs ${m.name2}${
            m.categoryName ? ` Ã‚Â· ${m.categoryName}` : ""
          }`;
          showToast(t, 3500);
        }

        // === TRAINING LOOP: SAFE/RISKY/AVOID ===
        if (cur === "SAFE" || cur === "RISKY" || cur === "AVOID") {
          const fav =
            m.ai?.features?.favName &&
            String(m.ai.features.favName).trim()
              ? m.ai.features.favName
              : m.name1;

          const aiTip = (m.ai?.tip && String(m.ai.tip).trim()) || "";
          const genericTip = /player\s*[ab]/i.test(aiTip);
          const tip = genericTip ? `${fav} to win` : aiTip || `${fav} to win`;

          logPrediction({
            matchId: m.id,
            label: cur,
            conf: m.ai?.conf || 0,
            tip,
            features: {
              ...m.ai?.features,
              favName: fav,
              setNum: m.setNum,
              live: m.live ? 1 : 0,
            },
          });

          addPending({ id: m.id, favName: fav, label: cur });
        }

        if (cur === "SAFE") {
          const t = `SAFE: ${m.name1} vs ${m.name2}${
            m.categoryName ? ` Ã‚Â· ${m.categoryName}` : ""
          }`;
          tryTg(t);
        }
      }

      lastLabelRef.current.set(m.id, cur);
    });
  }, [list, notificationsOn, audioOn]);

  const Pill = ({ label }) => {
    let bg = "#5a5f68";
    let fg = "#fff";
    let text = label;

    if (label === "SAFE") {
      bg = "#1fdd73";
      text = "SAFE";
    } else if (label === "RISKY") {
      bg = "#ffbf0a";
      fg = "#151515";
    } else if (label === "AVOID") {
      bg = "#e53935";
    } else if (label && label.startsWith("SET")) {
      bg = "#6e42c1";
    } else if (label === "UPCOMING") {
      bg = "#3a4452";
      text = "STARTS SOON";
    }

    return (
      <span
        style={{
          padding: "10px 14px",
          borderRadius: 14,
          fontWeight: 800,
          background: bg,
          color: fg,
          letterSpacing: 0.5,
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          display: "inline-block",
          minWidth: 96,
          textAlign: "center",
        }}
      >
        {text}
      </span>
    );
  };

  const Dot = ({ on }) => (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        display: "inline-block",
        background: on ? "#1fdd73" : "#e53935",
        boxShadow: on ? "0 0 0 2px rgba(31,221,115,0.25)" : "none",
      }}
    />
  );

  return (
    <div style={{ color: "#fff" }}>
      {loading && list.length === 0 ? (
        <div style={{ color: "#cfd3d7", padding: "8px 2px" }}>Loading...</div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((m) => (
          <div
            key={m.id}
            style={{
              borderRadius: 18,
              background: "#1b1e22",
              border: "1px solid #22272c",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Dot on={m.live} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: 1.25,
                  color: "#fff",
                }}
              >
                <span>{m.name1}</span>
                <span style={{ color: "#98a0a6", fontWeight: 600 }}>
                  {" "}
                  &nbsp;vs&nbsp;{" "}
                </span>
                <span>{m.name2}</span>
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#c2c7cc",
                  fontSize: 14,
                }}
              >
                {m.date} {m.time} Ã‚Â· {m.categoryName}
                {m.uiLabel === "UPCOMING" && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: "#9fb0c3",
                    }}
                  >
                    Ã¢â‚¬â€ starts in {m.startInText || "n/a"}
                  </span>
                )}
              </div>

              {(m.ai?.label === "SAFE" || m.ai?.label === "RISKY") &&
                m.ai?.tip && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#1fdd73",
                    }}
                  >
                    TIP: {m.ai.tip}
                  </div>
                )}
            </div>

            <Pill label={m.uiLabel} />
          </div>
        ))}

        {list.length === 0 && !loading && (
          <div
            style={{
              marginTop: 12,
              padding: "14px 16px",
              borderRadius: 12,
              background: "#121416",
              border: "1px solid #22272c",
              color: "#c7d1dc",
              fontSize: 13,
            }}
          >
            No live/upcoming matches found.
          </div>
        )}
      </div>
    </div>
  );
}