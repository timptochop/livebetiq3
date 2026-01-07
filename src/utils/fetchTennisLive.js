// src/utils/fetchTennisLive.js
import { buildOddsIndex } from "./oddsParser";

const DEFAULT_TZ_OFFSET_MINUTES = 120; // Cyprus (UTC+2 winter)

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
  return safeJsonParse(text);
}

/**
 * Normalize GoalServe-ish status values.
 * We have seen numeric-like statuses ("1") in some responses.
 * For UI logic, we want canonical strings like "Not Started" or "In Progress".
 */
function normalizeStatus(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  // numeric-like codes observed in the wild
  if (s === "0" || s === "1") return "Not Started";
  if (s === "2") return "In Progress";
  if (s === "3") return "Finished";

  // keep original for normal cases ("Not Started", "Live", etc.)
  return s;
}

function normalizePlayers(m) {
  // Backend usually provides players[], but some feeds use player[]
  const p = Array.isArray(m?.players)
    ? m.players
    : Array.isArray(m?.player)
    ? m.player
    : [];

  if (!p.length) return m;

  return {
    ...m,
    players: p.map((x) => ({
      id: x?.id ?? x?.["@id"] ?? x?.$?.id ?? null,
      name: x?.name ?? x?.["@name"] ?? x?.$?.name ?? "",
      s1: x?.s1 ?? "",
      s2: x?.s2 ?? "",
      s3: x?.s3 ?? "",
      s4: x?.s4 ?? "",
      s5: x?.s5 ?? "",
    })),
  };
}

export default async function fetchTennisLive(opts = {}) {
  const { signal, tzOffsetMinutes, debug = 0 } = opts;

  const tz = Number.isFinite(Number(tzOffsetMinutes))
    ? Number(tzOffsetMinutes)
    : DEFAULT_TZ_OFFSET_MINUTES;

  const params = new URLSearchParams();
  params.set("ts", String(Date.now()));
  params.set("tz", String(tz));
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
      console.warn(`[fetchTennisLive] tennis-live http ${res.status}`);
      return [];
    }

    const json = await safeReadJson(res);

    if (Array.isArray(json)) matches = json;
    else if (json && Array.isArray(json.matches)) matches = json.matches;
    else matches = [];
  } catch (err) {
    console.warn("[fetchTennisLive] tennis-live fetch failed", err);
    return [];
  }

  if (!matches.length) return [];

  // ✅ Normalize match shapes (status + players)
  const normalized = matches.map((m) => {
    const base = normalizePlayers(m || {});
    const statusRaw =
      base?.statusRaw ?? base?.status ?? base?.["@status"] ?? base?.$?.status ?? "";

    const status = normalizeStatus(statusRaw);

    return {
      ...base,
      status,
      statusRaw: String(statusRaw ?? status),
    };
  });

  // Odds enrichment is optional; NEVER fail the whole function.
  try {
    const oddsRes = await fetch("/api/gs/tennis-odds?ts=" + Date.now(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json,text/plain,*/*" },
    });

    if (!oddsRes.ok) return normalized;

    const oddsJson = await safeReadJson(oddsRes);
    if (!oddsJson || oddsJson.ok !== true) return normalized;

    const oddsIndex = buildOddsIndex ? buildOddsIndex(oddsJson) : null;
    if (!oddsIndex || typeof oddsIndex !== "object") return normalized;

    return normalized.map((m) => {
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
    return normalized;
  }
}