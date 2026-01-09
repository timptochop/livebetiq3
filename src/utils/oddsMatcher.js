// src/utils/oddsMatcher.js
// Minimal, deterministic matcher used by oddsParser.resolveOddsForLiveMatch()

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[()'".,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Basic token overlap score (0..100)
function tokenScore(a, b) {
  const A = normalizeName(a);
  const B = normalizeName(b);
  if (!A || !B) return 0;
  if (A === B) return 100;

  const ta = new Set(A.split(" ").filter(Boolean));
  const tb = new Set(B.split(" ").filter(Boolean));

  if (!ta.size || !tb.size) return 0;

  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;

  const union = ta.size + tb.size - inter;
  if (!union) return 0;

  const j = inter / union; // Jaccard
  return Math.max(0, Math.min(100, Math.round(j * 100)));
}

function extractLiveNames(liveMatch) {
  const m = liveMatch || {};
  const players = Array.isArray(m.players)
    ? m.players
    : Array.isArray(m.player)
    ? m.player
    : [];

  const p1 = players[0] || {};
  const p2 = players[1] || {};

  const n1 =
    m.player1 ||
    m.p1 ||
    p1.name ||
    p1["@name"] ||
    p1._ ||
    m.homeName ||
    "";

  const n2 =
    m.player2 ||
    m.p2 ||
    p2.name ||
    p2["@name"] ||
    p2._ ||
    m.awayName ||
    "";

  return { n1: String(n1 || ""), n2: String(n2 || "") };
}

function extractMeta(liveMatch) {
  const m = liveMatch || {};
  const date = String(m.date || m["@date"] || "");
  const time = String(m.time || m["@time"] || "");
  const league = String(m.league || m.categoryName || m["@category"] || m.category || "");
  return { date, time, league };
}

function clampScore(x) {
  const n = safeNumber(x, 0);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * @param {any} liveMatch
 * @param {Array<any>} oddsList - entries from oddsParser.buildOddsList()
 * @param {Object} opts
 * @returns {{ok:boolean, best?:any, score:number, meta:any}}
 */
export function findBestOddsForLiveMatch(liveMatch, oddsList, opts = {}) {
  const list = Array.isArray(oddsList) ? oddsList : [];
  const { n1, n2 } = extractLiveNames(liveMatch);
  const { date, time, league } = extractMeta(liveMatch);

  const minScore = safeNumber(opts.minScore, 70);

  const l1 = normalizeName(n1);
  const l2 = normalizeName(n2);

  if (!l1 || !l2 || list.length === 0) {
    return {
      ok: false,
      score: 0,
      meta: { reason: "missing_names_or_empty_list", n1, n2, list: list.length },
    };
  }

  let best = null;
  let bestScore = 0;
  let bestMeta = null;

  for (const e of list) {
    if (!e) continue;

    const o1 = e.player1 || e.homeName || "";
    const o2 = e.player2 || e.awayName || "";

    const a1 = normalizeName(o1);
    const a2 = normalizeName(o2);

    if (!a1 || !a2) continue;

    // try direct and swapped matching
    const direct =
      (tokenScore(l1, a1) + tokenScore(l2, a2)) / 2;

    const swapped =
      (tokenScore(l1, a2) + tokenScore(l2, a1)) / 2;

    let score = Math.max(direct, swapped);
    let orientation = direct >= swapped ? "direct" : "swapped";

    // small boost if league/tournament aligns (optional)
    const eLeague = String(e.league || e.tournament || "");
    if (league && eLeague) {
      const ls = tokenScore(league, eLeague);
      if (ls >= 60) score += 5;
    }

    // small boost if exact date/time present (optional)
    const eDate = String(e.date || "");
    const eTime = String(e.time || "");
    if (date && eDate && date === eDate) score += 3;
    if (time && eTime && time === eTime) score += 2;

    score = clampScore(score);

    if (score > bestScore) {
      bestScore = score;
      best = e;
      bestMeta = {
        orientation,
        directScore: Math.round(direct),
        swappedScore: Math.round(swapped),
        leagueHint: league || null,
        entryLeague: eLeague || null,
        dateHint: date || null,
        timeHint: time || null,
      };
    }
  }

  if (!best || bestScore < minScore) {
    return {
      ok: false,
      score: bestScore || 0,
      meta: {
        reason: "no_match_above_threshold",
        minScore,
        bestScore: bestScore || 0,
        live: { n1, n2, league, date, time },
        bestMeta,
      },
    };
  }

  return {
    ok: true,
    best,
    score: bestScore,
    meta: {
      reason: "matched",
      minScore,
      bestScore,
      live: { n1, n2, league, date, time },
      bestMeta,
    },
  };
}

export default findBestOddsForLiveMatch;