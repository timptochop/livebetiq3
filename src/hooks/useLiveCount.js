// src/hooks/useLiveCount.js
import { useEffect } from "react";
import { emitLiveCount } from "../utils/liveCount";

function isLiveMatch(m) {
  if (!m) return false;

  // explicit flags
  if (m.isLive === true || m.inPlay === true) return true;
  if (m.live?.isLive === true) return true;

  // status strings
  const s = (m.status || m.state || m.phase || "").toString().toLowerCase();
  if (s.includes("live") || s.includes("inplay") || s.includes("in play") || s.startsWith("set")) return true;

  // scoring hints
  if (m.score || m.sets > 0 || (m.set && Number.isFinite(m.set))) return true;

  return false;
}

export default function useLiveCount(items) {
  useEffect(() => {
    const list = Array.isArray(items) ? items : [];
    const live = list.reduce((n, it) => (isLiveMatch(it) ? n + 1 : n), 0);
    emitLiveCount(live);
    return () => emitLiveCount(0);
  }, [items]);
}