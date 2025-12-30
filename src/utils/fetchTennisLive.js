// src/utils/fetchTennisLive.js
import { buildOddsIndex } from "./oddsParser";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function safeReadJson(res) {
  const text = await res.text();
  if (!text) return null;
  // Some runtimes send JSON but with wrong headers; parse ourselves.
  return safeJsonParse(text);
}

export default async function fetchTennisLive(opts = {}) {
  const { signal, tzOffsetMinutes = 0, debug = 0 } = opts;

  const params = new URLSearchParams();
  params.set("ts", String(Date.now()));
  params.set("tzOffsetMinutes", String(tzOffsetMinutes));
  if (debug) params.set("debug", "1");

  const url = `/api/gs/tennis-live?${params.toString()}`;

  let matches = [];
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: { Accept: "application/json,text/plain,*/*" },
    });

    if (!res.ok) {
      // Fail-closed: return [] instead of throwing to UI
      console.warn(`[fetchTennisLive] tennis-live http ${res.status}`);
      return [];
    }

    const json = await safeReadJson(res);

    // Normalize shapes: {matches:[]}, {ok:true,matches:[]}, or raw []
    if (Array.isArray(json)) matches = json;
    else if (json && Array.isArray(json.matches)) matches = json.matches;
    else matches = [];
  } catch (err) {
    console.warn("[fetchTennisLive] tennis-live fetch failed", err);
    return [];
  }

  // If no matches, don't waste time on odds
  if (!matches.length) return [];

  // Odds enrichment is optional; NEVER fail the whole function.
  try {
    const oddsRes = await fetch("/api/gs/tennis-odds?ts=" + Date.now(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json,text/plain,*/*" },
    });

    if (!oddsRes.ok) return matches;

    const oddsJson = await safeReadJson(oddsRes);
    if (!oddsJson || oddsJson.ok !== true) return matches;

    // Some versions use oddsJson.raw, others already provide normalized fields
    const oddsIndex = buildOddsIndex ? buildOddsIndex(oddsJson) : null;
    if (!oddsIndex || typeof oddsIndex !== "object") return matches;

    return matches.map((m) => {
      const rawId = m?.id ?? m?.matchId ?? m?.matchid ?? m?.["@id"] ?? null;
      const matchId = rawId != null ? String(rawId).trim() : "";
      if (!matchId) return m;

      const odds = oddsIndex[matchId];
      if (!odds) return m;

      return {
        ...m,
        favName: odds.favName || m.favName,
        favOdds: odds.favOdds ?? m.favOdds,
        homeOdds: odds.homeOdds ?? m.homeOdds,
        awayOdds: odds.awayOdds ?? m.awayOdds,
        odds: { ...(m.odds || {}), ...odds },
      };
    });
  } catch (err) {
    console.warn("[fetchTennisLive] odds enrichment skipped", err);
    return matches;
  }
}