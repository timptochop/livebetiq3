// src/utils/oddsParser.js
// Robust odds index builder for GoalServe tennis odds feed (Home/Away moneyline)
// LOCKDOWN+ SAFE: no UI changes, only parsing fixes.

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

function toLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

function parseTs(tsRaw) {
  // GoalServe often uses numeric epoch seconds/ms as string (e.g. "1767879052")
  const s = String(tsRaw ?? "").trim();
  if (!s) return 0;

  // Numeric?
  if (/^\d{9,13}$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    // Heuristic: 13 digits => ms, 10 digits => seconds
    return s.length >= 13 ? n : n * 1000;
  }

  // ISO or other parseable format
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function pickBookmakers(bookmakers) {
  const arr = normalizeArray(bookmakers);
  if (!arr.length) return [];

  // Prefer bet365 > Marathon > Unibet > first available (stable ordering)
  const preferred = ["bet365", "marathon", "unibet"];
  const scored = arr
    .map((bk) => {
      const name = toLower(bk?.name || bk?.["@name"] || "");
      const score = preferred.indexOf(name);
      return { bk, score: score === -1 ? 999 : score };
    })
    .sort((a, b) => a.score - b.score);

  // Put preferred first but keep others after
  return scored.map((x) => x.bk);
}

function extractHomeAwayOdds(oddsArr) {
  const arr = normalizeArray(oddsArr);
  if (arr.length < 2) return { homeOdds: null, awayOdds: null };

  // Prefer by explicit name if present
  const byName = (n) =>
    arr.find((o) => toLower(o?.name || o?.["@name"]) === n);

  const homeObj = byName("home");
  const awayObj = byName("away");

  const homeOdds = toNumberOrNull(homeObj?.value ?? homeObj?.["@value"]);
  const awayOdds = toNumberOrNull(awayObj?.value ?? awayObj?.["@value"]);

  if (homeOdds && awayOdds) return { homeOdds, awayOdds };

  // Fallback: try first two entries
  const o0 = toNumberOrNull(arr[0]?.value ?? arr[0]?.["@value"]);
  const o1 = toNumberOrNull(arr[1]?.value ?? arr[1]?.["@value"]);
  return { homeOdds: o0, awayOdds: o1 };
}

export function buildOddsIndex(feed) {
  // Accept: { raw }, { data }, { ok, data }, or raw payload directly
  const raw =
    (feed && feed.raw) ||
    (feed && feed.data) ||
    (feed && feed.ok === true && feed.data) ||
    feed;

  const out = Object.create(null);
  if (!raw || typeof raw !== "object") return out;

  const scores = raw.scores || raw;
  const categories = normalizeArray(scores.category);

  categories.forEach((cat) => {
    if (!cat) return;

    // Some feeds: cat.match, some: cat.matches.match
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
      const matchId = String(mid);

      const players = normalizeArray(m.player || m.players);
      const p1 = players[0] || {};
      const p2 = players[1] || {};

      const homeName = p1.name || p1["@name"] || p1._ || "";
      const awayName = p2.name || p2["@name"] || p2._ || "";

      const oddsRoot = m.odds || m.Odds || {};
      const types = normalizeArray(oddsRoot.type);

      // Find Home/Away market
      const moneylineType = types.find((t) => {
        const tVal = t?.value || t?.["@value"] || t?.type || "";
        const label = toLower(tVal);
        return label.includes("home/away");
      });

      if (!moneylineType) return;

      const booksRaw = moneylineType.bookmaker || moneylineType.Bookmaker;
      const books = pickBookmakers(booksRaw);

      let best = null;

      // Strategy:
      // - Prefer bet365/Marathon/Unibet if available (stable)
      // - Otherwise choose latest ts if provided
      // - Always skip stop=true
      for (const bk of books) {
        if (!bk) continue;

        const stop = toLower(bk.stop || bk["@stop"] || "");
        if (stop === "true") continue;

        const tsRaw = bk.last_update || bk["@last_update"] || bk.ts || bk["@ts"];
        const ts = parseTs(tsRaw);

        const { homeOdds, awayOdds } = extractHomeAwayOdds(bk.odd);

        if (!homeOdds || !awayOdds || homeOdds <= 1 || awayOdds <= 1) continue;

        const bookmaker = bk.name || bk["@name"] || "";

        // If we already have a preferred bookmaker (bet365 etc), keep first hit.
        if (!best) {
          best = { homeOdds, awayOdds, bookmaker, ts };
          // If bookmaker is preferred, we can stop early
          const bn = toLower(bookmaker);
          if (bn === "bet365" || bn === "marathon" || bn === "unibet") break;
          continue;
        }

        // Otherwise pick the latest timestamp
        if (ts >= (best.ts || 0)) {
          best = { homeOdds, awayOdds, bookmaker, ts };
        }
      }

      if (!best) return;

      const { homeOdds, awayOdds, bookmaker, ts } = best;

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

      out[matchId] = {
        matchId,
        homeName,
        awayName,
        homeOdds,
        awayOdds,
        favName,
        favOdds,
        dogName,
        dogOdds,
        bookmaker,
        ts,
      };
    });
  });

  return out;
}

export default buildOddsIndex;