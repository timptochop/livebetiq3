// src/utils/oddsParser.js

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

export function buildOddsIndex(feed) {
  const raw = feed && feed.raw ? feed.raw : feed;
  const out = Object.create(null);

  if (!raw || typeof raw !== "object") {
    return out;
  }

  const scores = raw.scores || raw;
  const categories = normalizeArray(scores.category);

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

          const oHome = toNumberOrNull(
            oddsArr[0].value || oddsArr[0]["@value"]
          );
          const oAway = toNumberOrNull(
            oddsArr[1].value || oddsArr[1]["@value"]
          );

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

      out[mid] = {
        matchId: mid,
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