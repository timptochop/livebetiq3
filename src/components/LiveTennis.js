// src/components/LiveTennis.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import fetchTennisLive from "../utils/fetchTennisLive";
import fetchTennisOdds from "../utils/fetchTennisOdds";
import buildOddsIndex from "../utils/oddsParser";
import { trackOdds, getDrift } from "../utils/oddsTracker";
import analyzeMatch from "../utils/analyzeMatch";
import { showToast } from "../utils/toast";
import useLiveCount from "../hooks/useLiveCount";
import { logPrediction, addPending, trySettleFinished } from "../utils/predictionLogger";
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

const toLower = (v) => String(v ?? "").trim().toLowerCase();
const isFinishedLike = (s) => FINISHED.has(toLower(s));

const isUpcomingLike = (s) => {
  const x = toLower(s);
  return (
    x === "not started" ||
    x === "scheduled" ||
    x === "upcoming" ||
    x === "ns" ||
    x === "0" ||
    x === "pending"
  );
};

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

/**
 * Robust date parsing for GoalServe-like formats:
 * - "YYYY-MM-DD" + "HH:MM"
 * - "DD.MM.YYYY" + "HH:MM"
 * - "DD/MM/YYYY" + "HH:MM"
 * Returns a Date or null.
 */
function parseStart(dateStr, timeStr) {
  const dRaw = String(dateStr || "").trim();
  const tRaw = String(timeStr || "").trim();
  if (!dRaw || !tRaw) return null;

  const t = tRaw.length === 5 ? `${tRaw}:00` : tRaw;

  const dtIso = new Date(`${dRaw}T${t}`);
  if (Number.isFinite(dtIso.getTime())) return dtIso;

  const m = dRaw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    if (Number.isFinite(dd) && Number.isFinite(mm) && Number.isFinite(yyyy)) {
      const iso = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(
        2,
        "0"
      )}-${String(dd).padStart(2, "0")}T${t}`;
      const dt = new Date(iso);
      if (Number.isFinite(dt.getTime())) return dt;
    }
  }

  const dtSpace = new Date(`${dRaw} ${tRaw}`);
  return Number.isFinite(dtSpace.getTime()) ? dtSpace : null;
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
  LIVE: 4,
  "SET 3": 5,
  "SET 2": 6,
  "SET 1": 7,
  UPCOMING: 8,
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
      // Stability Freeze:
      // Use ONLY the existing fetchTennisLive() transport (no tz forcing).
      const base = await fetchTennisLive();
      const baseArr = Array.isArray(base) ? base : [];

      const keep = baseArr.filter((m) => !isFinishedLike(m.status || m["@status"]));

      const hasLive = keep.some((m) => {
        const raw = m.status || m["@status"] || "";
        return !!raw && !isUpcomingLike(raw) && !isFinishedLike(raw);
      });

      let oddsRaw = null;
      if (hasLive) {
        try {
          oddsRaw = await fetchTennisOdds();
        } catch {
          oddsRaw = null;
        }
      }

      const oddsIndex =
        oddsRaw && typeof oddsRaw === "object" ? buildOddsIndex({ raw: oddsRaw }) || {} : {};

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

        const matchId = m.id || m["@id"] || `${date}-${time}-${name1}-${name2}-${idx}`;

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

        const ai = analyzeMatch({ ...m, odds }, extraFeatures) || {};

        let startAt = null;
        let startInMs = null;
        let startInText = null;

        if (isUpcomingLike(status)) {
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
          categoryName: m.categoryName || m["@category"] || m.category || "",
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

      await Promise.allSettled(baseArr.map((m) => maybeLogResult(m)));
      trySettleFinished(baseArr);
    } catch {
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
      const rawStatus = m.status || "";
      const live = !!rawStatus && !isUpcomingLike(rawStatus) && !isFinishedLike(rawStatus);

      let label = m.ai?.label || null;

      if (!live && isUpcomingLike(rawStatus)) {
        label = "UPCOMING";
      } else if (live) {
        if (!label || label === "PENDING" || label === "UPCOMING" || label === "SOON" || label === "STARTS SOON") {
          label = (m.setNum || 0) > 0 ? `SET ${m.setNum}` : "LIVE";
        }
      } else {
        if (!label || label === "PENDING") label = "UPCOMING";
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

      if (a.order >= 5 && a.order <= 7 && b.order >= 5 && b.order <= 7) {
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
            // eslint-disable-next-line no-new
            new Audio("/notify.mp3").play().catch(() => {});
          } catch {
            // ignore
          }
        }

        if (notificationsOn) {
          const t = `${cur}: ${m.name1} vs ${m.name2}${m.categoryName ? ` · ${m.categoryName}` : ""}`;
          showToast(t, 3500);
        }

        if (cur === "SAFE" || cur === "RISKY" || cur === "AVOID") {
          const fav =
            m.ai?.features?.favName && String(m.ai.features.favName).trim()
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
          const t = `SAFE: ${m.name1} vs ${m.name2}${m.categoryName ? ` · ${m.categoryName}` : ""}`;
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
    } else if (label === "LIVE") {
      bg = "#2d7ff9";
      text = "LIVE";
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
                <span style={{ color: "#98a0a6", fontWeight: 600 }}> &nbsp;vs&nbsp; </span>
                <span>{m.name2}</span>
              </div>

              <div style={{ marginTop: 6, color: "#c2c7cc", fontSize: 14 }}>
                {m.date} {m.time} · {m.categoryName}
                {m.uiLabel === "UPCOMING" && (
                  <span style={{ marginLeft: 8, color: "#9fb0c3" }}>
                    — starts in {m.startInText || "n/a"}
                  </span>
                )}
              </div>

              {(m.ai?.label === "SAFE" || m.ai?.label === "RISKY") && m.ai?.tip && (
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: "#1fdd73" }}>
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