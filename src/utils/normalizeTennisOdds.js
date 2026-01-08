// src/utils/normalizeTennisOdds.js
// Normalize GoalServe tennis odds payload for AI engine
// LOCKDOWN+ safe | Robust to wrapper payloads + schema variance

export default function normalizeTennisOdds(raw) {
  // Accept either raw odds object OR wrapper { ok, data }
  const root = raw?.data && typeof raw?.ok === "boolean" ? raw.data : raw;

  const scores = root?.scores;
  const category = scores?.category;
  if (!scores || !category) return [];

  const categories = Array.isArray(category) ? category : [category];
  const rows = [];

  for (const cat of categories) {
    const matchList = cat?.match;
    if (!matchList) continue;

    const matches = Array.isArray(matchList) ? matchList : [matchList];

    for (const m of matches) {
      const oddsBlock = m?.odds;
      if (!oddsBlock?.type) continue;

      const types = Array.isArray(oddsBlock.type) ? oddsBlock.type : [oddsBlock.type];

      // Moneyline = "Home/Away" (sometimes appears as variations)
      const moneyline = types.find((t) => {
        const v = String(t?.value || "").toLowerCase();
        return v.includes("home/away") || v === "home away" || v === "home-away";
      });

      if (!moneyline?.bookmaker) continue;

      const books = Array.isArray(moneyline.bookmaker)
        ? moneyline.bookmaker
        : [moneyline.bookmaker];

      const pickBook = (name) =>
        books.find((b) => String(b?.name || "").toLowerCase() === name);

      const book = pickBook("bet365") || pickBook("marathon") || books[0];
      if (!book?.odd) continue;

      const oddsArr = Array.isArray(book.odd) ? book.odd : [book.odd];

      const home = oddsArr.find((o) => String(o?.name || "").toLowerCase() === "home");
      const away = oddsArr.find((o) => String(o?.name || "").toLowerCase() === "away");

      if (!home || !away) continue;

      const homeOdd = Number(home.value);
      const awayOdd = Number(away.value);
      if (!Number.isFinite(homeOdd) || !Number.isFinite(awayOdd)) continue;

      const p = m?.player;
      const players = Array.isArray(p) ? p : p ? [p] : [];

      rows.push({
        matchId: String(m?.id || ""),
        home: players?.[0]?.name || "",
        away: players?.[1]?.name || "",
        odds: {
          home: homeOdd,
          away: awayOdd,
        },
        bookmaker: book?.name || "",
      });
    }
  }

  return rows;
}