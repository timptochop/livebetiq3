// src/utils/oddsParser.js

import { findBestOddsForLiveMatch } from "./oddsMatcher";

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeArray(x) {
  if (Array.isArray(x)) return x;
  if (x === null || x === undefined) return [];
  return [x];
}

function safeGet(obj, path, def = null) {
  try {
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return def;
      cur = cur[p];
    }
    return cur == null ? def : cur;
  } catch {
    return def;
  }
}

function extractOddsEntries(feed) {
  const raw = feed && feed.raw ? feed.raw : feed;
  if (!raw || typeof raw !== "object") return [];

  const scores = raw.scores || raw;
  const categories = normalizeArray(scores.category);

  const entries = [];

  categories.forEach((cat) => {
    if (!cat) return;

    const matchesContainer = cat.matches || cat.match || {};
    const matches = normalizeArray(matchesContainer.match || matchesContainer);

    matches.forEach((m) => {
      if (!m) return;

      const mid =
        m.id ||
        m.matchid ||
        m["@id"] ||
        m["@matchid"] ||
        safeGet(m, "id._text") ||
        null;

      if (!mid) return;

      const players = normalizeArray(m.player || m.players);
      const p1 = players[0] || {};
      const p2 = players[1] || {};

      const homeName = p1.name || p1["@name"] || p1._ || "";
      const awayName = p2.name || p2["@name"] || p2._ || "";

      const oddsRoot = m.odds || m.Odds || {};
      const types = normalizeArray(oddsRoot.type);

      let bestBook = null;
      let bestBookTs = 0;

      types.forEach((t) => {
        if (!t) return;
        const tVal = t.value || t["@value"] || t.type;
        if (!tVal) return;

        const label = String(tVal).toLowerCase();
        if (!label.startsWith("home/away")) return;

        const books = normalizeArray(t.bookmaker || t.Bookmaker);
        books.forEach((bk) => {
          if (!bk) return;

          const stop = String(bk.stop || bk["@stop"] || "").toLowerCase();
          if (stop === "true") return;

          const tsRaw = bk.last_update || bk["@last_update"] || bk.ts;
          const ts = Date.parse(tsRaw) || 0;

          const oddsArr = normalizeArray(bk.odd);
          if (oddsArr.length < 2) return;

          const oHome = toNumberOrNull(oddsArr[0].value || oddsArr[0]["@value"]);
          const oAway = toNumberOrNull(oddsArr[1].value || oddsArr[1]["@value"]);

          if (!oHome || !oAway) return;

          if (ts >= bestBookTs) {
            bestBookTs = ts;
            bestBook = {
              homeOdds: oHome,
              awayOdds: oAway,
              name: bk.name || bk["@name"] || "",
              ts,
            };
          }
        });
      });

      if (!bestBook) return;

      const { homeOdds, awayOdds, name: bookmaker, ts } = bestBook;

      let favName = homeName;
      let favOdds = homeOdds;
      let dogName = awayName;
      let dogOdds = awayOdds;

      if (awayOdds < homeOdds) {
        favName = awayName;
        favOdds = awayOdds;
        dogName = homeName;
        dogOdds = homeOdds;
      }

      entries.push({
        matchId: String(mid),

        // names for matching
        player1: homeName,
        player2: awayName,
        homeName,
        awayName,

        // odds
        homeOdds,
        awayOdds,
        favName,
        favOdds,
        dogName,
        dogOdds,

        bookmaker,
        ts,

        // optional hints
        tournament: cat.name || cat["@name"] || cat.id || cat["@id"] || "",
        league: cat.name || cat["@name"] || "",
      });
    });
  });

  return entries;
}

/**
 * Backward-compatible: builds { [matchId]: oddsObj }
 */
export function buildOddsIndex(feed) {
  const out = Object.create(null);
  const entries = extractOddsEntries(feed);

  entries.forEach((e) => {
    if (!e || !e.matchId) return;
    out[String(e.matchId)] = {
      matchId: String(e.matchId),
      homeName: e.homeName,
      awayName: e.awayName,
      homeOdds: e.homeOdds,
      awayOdds: e.awayOdds,
      favName: e.favName,
      favOdds: e.favOdds,
      dogName: e.dogName,
      dogOdds: e.dogOdds,
      bookmaker: e.bookmaker,
      ts: e.ts,
    };
  });

  try {
    // eslint-disable-next-line no-console
    console.log("[ODDS INDEX KEYS]", Object.keys(out).slice(0, 12));
  } catch {}

  return out;
}

/**
 * New: builds a list array (matcher-ready).
 */
export function buildOddsList(feed) {
  return extractOddsEntries(feed);
}

/**
 * New: deterministic odds resolution for a live match:
 * 1) try direct matchId lookup in oddsIndex
 * 2) fallback to matcher (players/league/time) using oddsList
 */
export function resolveOddsForLiveMatch(liveMatch, oddsIndex, oddsList, opts = {}) {
  const id =
    liveMatch?.matchId ||
    liveMatch?.id ||
    liveMatch?.matchid ||
    liveMatch?.["@id"] ||
    liveMatch?.["@matchid"] ||
    null;

  const key = id ? String(id) : null;

  if (key && oddsIndex && oddsIndex[key]) {
    return {
      ok: true,
      odds: oddsIndex[key],
      via: "matchId",
      score: 100,
      meta: { reason: "direct_index_hit", matchId: key },
    };
  }

  const list = Array.isArray(oddsList) ? oddsList : [];
  const r = findBestOddsForLiveMatch(liveMatch, list, opts);

  if (r.ok && r.best) {
    const o = r.best;
    return {
      ok: true,
      odds: {
        matchId: String(o.matchId || o.id || ""),
        homeName: o.homeName || o.player1 || "",
        awayName: o.awayName || o.player2 || "",
        homeOdds: o.homeOdds,
        awayOdds: o.awayOdds,
        favName: o.favName,
        favOdds: o.favOdds,
        dogName: o.dogName,
        dogOdds: o.dogOdds,
        bookmaker: o.bookmaker || "",
        ts: o.ts || 0,
      },
      via: "matcher",
      score: r.score,
      meta: r.meta,
    };
  }

  return {
    ok: false,
    odds: null,
    via: "none",
    score: r?.score || 0,
    meta: r?.meta || { reason: "no_match" },
  };
}

export default buildOddsIndex;