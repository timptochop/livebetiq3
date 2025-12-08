// src/utils/oddsParser.js

function buildOddsIndex(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const scores = raw.scores;
  if (!scores) return {};

  let categories = scores.category || [];
  if (!Array.isArray(categories)) {
    categories = [categories];
  }

  const index = {};

  for (const cat of categories) {
    if (!cat || typeof cat !== 'object') continue;

    let matches = cat.matches && cat.matches.match;
    if (!matches) continue;
    if (!Array.isArray(matches)) {
      matches = [matches];
    }

    for (const m of matches) {
      if (!m || typeof m !== 'object') continue;

      const matchId = String(
        m.id ??
        m.matchid ??
        (m['@id'] ?? '')
      ).trim();

      if (!matchId) continue;

      let players = m.player || [];
      if (!Array.isArray(players)) {
        players = [players];
      }
      if (players.length < 2) continue;

      const p1 = players[0] || {};
      const p2 = players[1] || {};
      const homeName = (p1.name ?? p1['@name'] ?? '').trim();
      const awayName = (p2.name ?? p2['@name'] ?? '').trim();
      if (!homeName || !awayName) continue;

      const oddsBlock = m.odds || m['@odds'] || {};
      let types = oddsBlock.type || [];
      if (!Array.isArray(types)) {
        types = [types];
      }
      if (!types.length) continue;

      let homeAwayType = null;
      for (const t of types) {
        if (!t) continue;
        const label = String(t.value ?? t['@value'] ?? '').trim();
        if (!label) continue;

        if (label === 'Home/Away') {
          homeAwayType = t;
          break;
        }
        if (!homeAwayType && label.startsWith('Home/Away')) {
          homeAwayType = t;
        }
      }
      if (!homeAwayType) continue;

      let bookmakers = homeAwayType.bookmaker || [];
      if (!Array.isArray(bookmakers)) {
        bookmakers = [bookmakers];
      }
      if (!bookmakers.length) continue;

      let chosen = null;
      for (const bk of bookmakers) {
        if (!bk) continue;
        const stop = String(bk.stop ?? '').toLowerCase();
        if (stop === 'true') continue;

        const tsNum = toIntSafe(bk.ts);
        if (!chosen || tsNum > chosen.ts) {
          chosen = { ts: tsNum, node: bk };
        }
      }

      if (!chosen) {
        const fallbackBk = bookmakers[0];
        chosen = {
          ts: toIntSafe(fallbackBk && fallbackBk.ts),
          node: fallbackBk,
        };
      }

      const bk = chosen.node || {};
      let oddsList = bk.odd || [];
      if (!Array.isArray(oddsList)) {
        oddsList = [oddsList];
      }
      if (oddsList.length < 2) continue;

      const homeOdds = toFloatSafe(oddsList[0] && oddsList[0].value);
      const awayOdds = toFloatSafe(oddsList[1] && oddsList[1].value);

      if (!Number.isFinite(homeOdds) || !Number.isFinite(awayOdds)) {
        continue;
      }
      if (homeOdds <= 1.01 && awayOdds <= 1.01) {
        continue;
      }

      let favName, favOdds, dogName, dogOdds;
      if (homeOdds <= awayOdds) {
        favName = homeName;
        favOdds = homeOdds;
        dogName = awayName;
        dogOdds = awayOdds;
      } else {
        favName = awayName;
        favOdds = awayOdds;
        dogName = homeName;
        dogOdds = homeOdds;
      }

      index[matchId] = {
        matchId,
        homeName,
        awayName,
        homeOdds,
        awayOdds,
        favName,
        favOdds,
        dogName,
        dogOdds,
        bookmaker: bk.name ?? bk['@name'] ?? null,
        ts: chosen.ts || null,
      };
    }
  }

  return index;
}

function toFloatSafe(value) {
  if (value === null || value === undefined) return NaN;
  const num = Number(String(value).replace(',', '.'));
  return Number.isFinite(num) ? num : NaN;
}

function toIntSafe(value) {
  if (value === null || value === undefined) return 0;
  const num = parseInt(String(value).trim(), 10);
  return Number.isFinite(num) ? num : 0;
}

export default buildOddsIndex;