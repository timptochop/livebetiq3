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
 * Observed: numeric-like codes ("0","1","2","3") + text.
 */
function normalizeStatus(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  // numeric-like codes observed
  if (s === "0" || s === "1") return "Not Started";
  if (s === "2") return "In Progress";
  if (s === "3") return "Finished";

  return s;
}

function normalizePlayers(m) {
  const p = Array.isArray(m?.players)
    ? m.players
    : Array.isArray(m?.player)
    ? m.player
    : [];

  if (!p.length) return { ...(m || {}), players: [] };

  return {
    ...(m || {}),
    players: p.slice(0, 2).map((x) => ({
      id: x?.id ?? x?.["@id"] ?? x?.$?.id ?? null,
      name: x?.name ?? x?.["@name"] ?? x?.$?.name ?? "",
      s1: x?.s1 ?? x?.["@s1"] ?? "",
      s2: x?.s2 ?? x?.["@s2"] ?? "",
      s3: x?.s3 ?? x?.["@s3"] ?? "",
      s4: x?.s4 ?? x?.["@s4"] ?? "",
      s5: x?.s5 ?? x?.["@s5"] ?? "",
    })),
  };
}

function hasScores(players) {
  const p = Array.isArray(players) ? players : [];
  for (const pl of p) {
    const vals = [pl?.s1, pl?.s2, pl?.s3, pl?.s4, pl?.s5].map((v) =>
      String(v ?? "").trim()
    );
    if (vals.some((v) => v !== "")) return true;
  }
  return false;
}

function statusLooksLive(status) {
  const x = String(status ?? "").trim().toLowerCase();
  return x === "in progress" || x === "live" || x === "playing" || x === "started";
}

function statusLooksFinished(status) {
  const x = String(status ?? "").trim().toLowerCase();
  return (
    x === "finished" ||
    x === "cancelled" ||
    x === "retired" ||
    x === "abandoned" ||
    x === "postponed" ||
    x === "walk over"
  );
}

function unwrapOddsPayload(oddsJson) {
  if (!oddsJson || typeof oddsJson !== "object") return null;

  // common shapes:
  // { ok:true, data:{...} }
  // { ok:true, raw:{...} }
  // { scores:{...} } (already unwrapped)
  if (oddsJson.data && typeof oddsJson.data === "object") return oddsJson.data;
  if (oddsJson.raw && typeof oddsJson.raw === "object") return oddsJson.raw;

  // sometimes the API already returns the feed root
  return oddsJson;
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

    // NOTE: backend is designed to return 200 even on upstream errors.
    // So res.ok is not a reliable signal. We still keep the guard for truly broken responses.
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

  // ✅ Normalize match shapes: status + players + isLive detection
  const normalized = matches
    .map((m) => {
      const base0 = m || {};
      const base = normalizePlayers(base0);

      const statusRaw =
        base?.statusRaw ??
        base?.status ??
        base?.["@status"] ??
        base?.$?.status ??
        "";

      const status = normalizeStatus(statusRaw);
      const scoresPresent = hasScores(base.players);

      // If backend already computed isLive, trust it; otherwise compute deterministically.
      const fromBackend = base0?.isLive;
      const backendIsLive = typeof fromBackend === "boolean" ? fromBackend : null;

      const computedIsLive =
        statusLooksLive(status) ||
        scoresPresent ||
        String(statusRaw ?? "").trim() === "2"; // numeric fallback

      const isLive = backendIsLive !== null ? backendIsLive : computedIsLive;

      return {
        ...base,
        status,
        statusRaw: String(statusRaw ?? status),
        isLive,
        _scoresPresent: scoresPresent,
        _liveByStatus: statusLooksLive(status),
      };
    })
    // Safety: never send finished-like to UI if any slip through
    .filter((m) => !statusLooksFinished(m.status));

  if (!normalized.length) return [];

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
    if (!oddsJson) return normalized;

    // If endpoint uses {ok:true}, honor it. If not present, still try to parse.
    if (oddsJson.ok === false) return normalized;

    const payload = unwrapOddsPayload(oddsJson);
    if (!payload || typeof payload !== "object") return normalized;

    // IMPORTANT: oddsParser expects { raw } or raw feed. We pass { raw: payload }.
    const oddsIndex = buildOddsIndex ? buildOddsIndex({ raw: payload }) : null;
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