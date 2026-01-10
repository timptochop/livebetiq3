// src/utils/oddsMatcher.js
// Canonical deterministic fuzzy matcher: Odds <-> Matches
// Provides:
// - default export: matchOddsToMatches(matches, oddsList, opts)
// - named export: findBestOddsForLiveMatch(match, oddsList, opts)
// Diagnostics (LOCKDOWN+):
// - Set REACT_APP_ODDS_DEBUG=1 to emit 2 snapshots max (per runtime).

const DEFAULT_OPTS = Object.freeze({
  maxTimeWindowMinutes: 90,
  minNameScore: 0.86,
  minTotalScore: 0.78,
  allowSwapPlayers: true,
  enableDiagnostics: true,
  aliases: {},
});

/** ---- DIAGNOSTICS (throttled) ---- */
const __ODDS_DEBUG =
  typeof process !== "undefined" &&
  process?.env &&
  String(process.env.REACT_APP_ODDS_DEBUG || "").trim() === "1";

let __diagCalls = 0;
const __MAX_DIAG_CALLS = 2;

function diagSnapshot(tag, payload) {
  try {
    if (!__ODDS_DEBUG) return;
    if (__diagCalls >= __MAX_DIAG_CALLS) return;
    __diagCalls += 1;

    const { matchCount, oddsCount, matchedCount, topRejects, samplePairs } = payload || {};

    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `%c[ODDS MATCH DIAG #${__diagCalls}] ${tag} | matches=${matchCount} odds=${oddsCount} matched=${matchedCount}`,
      "color:#9ddcff;font-weight:600"
    );

    if (Array.isArray(samplePairs) && samplePairs.length) {
      // eslint-disable-next-line no-console
      console.table(
        samplePairs.map((p) => ({
          matchId: p.matchId,
          oddsId: p.oddsId,
          score: p.score,
          nameScore: p.nameScore,
          tourScore: p.tourScore,
          timeDiffMin: Number.isFinite(p.timeDiffMin) ? p.timeDiffMin : "NA",
          swapped: p.swapped,
        }))
      );
    } else {
      // eslint-disable-next-line no-console
      console.log("[ODDS MATCH DIAG] No pairs matched.");
    }

    if (Array.isArray(topRejects) && topRejects.length) {
      // eslint-disable-next-line no-console
      console.table(topRejects);
    } else {
      // eslint-disable-next-line no-console
      console.log("[ODDS MATCH DIAG] No reject reasons captured (or diagnostics disabled).");
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  } catch {
    // silent
  }
}

function isFiniteNumber(x) {
  return Number.isFinite(x);
}

function safeStr(x) {
  return String(x ?? "").trim();
}

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeName(raw, aliases) {
  let s = safeStr(raw);
  if (!s) return "";

  s = stripDiacritics(s);
  s = s.toUpperCase();
  s = s.replace(/[^A-Z0-9\s]/g, " ");
  s = normalizeWhitespace(s);

  if (s.includes(",")) {
    const parts = s.split(",").map((p) => normalizeWhitespace(p));
    if (parts.length >= 2) s = normalizeWhitespace(`${parts[1]} ${parts[0]}`);
  }

  s = s
    .split(" ")
    .filter((tok) => tok && tok.length > 0)
    .join(" ");

  if (aliases && aliases[s]) return aliases[s];
  return s;
}

function normalizeTournament(raw) {
  let s = safeStr(raw);
  if (!s) return "";
  s = stripDiacritics(s).toUpperCase();
  s = s.replace(/[^A-Z0-9\s]/g, " ");
  s = normalizeWhitespace(s);

  const drop = new Set(["ATP", "WTA", "ITF", "CHALLENGER", "MEN", "WOMEN", "SINGLES", "DOUBLES"]);
  const tokens = s.split(" ").filter((t) => t && !drop.has(t));
  return tokens.join(" ");
}

function normalizeSurface(raw) {
  const s = safeStr(raw).toLowerCase();
  if (!s) return "";
  if (s.includes("clay")) return "clay";
  if (s.includes("grass")) return "grass";
  if (s.includes("hard")) return "hard";
  return s;
}

function tokenize(s) {
  const x = safeStr(s);
  if (!x) return [];
  return x.split(" ").filter(Boolean);
}

function jaccardSimilarity(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function levenshtein(a, b) {
  const s = safeStr(a);
  const t = safeStr(b);
  if (s === t) return 0;
  if (!s) return t.length;
  if (!t) return s.length;

  const m = s.length;
  const n = t.length;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const si = s.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = si === t.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

function stringSimilarity(a, b) {
  const s = safeStr(a);
  const t = safeStr(b);
  if (!s && !t) return 1;
  if (!s || !t) return 0;

  const sa = tokenize(s);
  const sb = tokenize(t);
  const jac = jaccardSimilarity(sa, sb);

  const dist = levenshtein(s, t);
  const maxLen = Math.max(s.length, t.length);
  const editSim = maxLen <= 0 ? 1 : 1 - dist / maxLen;

  return 0.6 * jac + 0.4 * editSim;
}

function parseTimeToEpochMs(value) {
  if (value === null || value === undefined) return NaN;

  if (typeof value === "number") {
    if (!isFiniteNumber(value)) return NaN;
    return value < 1e12 ? value * 1000 : value;
  }

  const s = safeStr(value);
  if (!s) return NaN;

  const d = Date.parse(s);
  return Number.isFinite(d) ? d : NaN;
}

function minutesDiffAbs(aMs, bMs) {
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return NaN;
  return Math.abs(aMs - bMs) / 60000;
}

function extractMatchFields(match) {
  const p1 = match?.player1 ?? match?.home ?? match?.team1 ?? match?.p1 ?? match?.player_1 ?? "";
  const p2 = match?.player2 ?? match?.away ?? match?.team2 ?? match?.p2 ?? match?.player_2 ?? "";

  const tournament =
    match?.tournament ??
    match?.league ??
    match?.category ??
    match?.event ??
    match?.competition ??
    match?.tour ??
    "";

  const surface = match?.surface ?? match?.court ?? match?.courtType ?? "";

  const start =
    match?.startTime ??
    match?.start_time ??
    match?.time ??
    match?.datetime ??
    match?.dateTime ??
    match?.kickoff ??
    match?.ts ??
    match?.timestamp ??
    "";

  const id = match?.id ?? match?.matchId ?? match?.match_id ?? match?.eventId ?? match?.key ?? "";

  return { id, p1, p2, tournament, surface, start };
}

function extractOddsFields(odds) {
  const p1 = odds?.player1 ?? odds?.home ?? odds?.team1 ?? odds?.p1 ?? odds?.player_1 ?? "";
  const p2 = odds?.player2 ?? odds?.away ?? odds?.team2 ?? odds?.p2 ?? odds?.player_2 ?? "";

  const tournament =
    odds?.tournament ??
    odds?.league ??
    odds?.category ??
    odds?.event ??
    odds?.competition ??
    odds?.tour ??
    "";

  const surface = odds?.surface ?? odds?.court ?? odds?.courtType ?? "";

  const start =
    odds?.startTime ??
    odds?.start_time ??
    odds?.time ??
    odds?.datetime ??
    odds?.dateTime ??
    odds?.kickoff ??
    odds?.ts ??
    odds?.timestamp ??
    "";

  const id = odds?.id ?? odds?.oddsId ?? odds?.matchId ?? odds?.match_id ?? odds?.key ?? "";

  return { id, p1, p2, tournament, surface, start };
}

function computeNamePairScore(m1, m2, o1, o2) {
  const sA = stringSimilarity(m1, o1);
  const sB = stringSimilarity(m2, o2);
  return (sA + sB) / 2;
}

function computeNameScore(matchP1, matchP2, oddsP1, oddsP2, allowSwap) {
  const direct = computeNamePairScore(matchP1, matchP2, oddsP1, oddsP2);
  if (!allowSwap) return { score: direct, swapped: false };

  const swapped = computeNamePairScore(matchP1, matchP2, oddsP2, oddsP1);
  if (swapped > direct) return { score: swapped, swapped: true };
  return { score: direct, swapped: false };
}

function timeScore(matchStartMs, oddsStartMs, maxWindowMin) {
  const diffMin = minutesDiffAbs(matchStartMs, oddsStartMs);
  if (!Number.isFinite(diffMin)) return { ok: true, score: 0.5, diffMin: NaN };
  if (diffMin > maxWindowMin) return { ok: false, score: 0, diffMin };
  const x = Math.max(0, Math.min(1, diffMin / maxWindowMin));
  const score = 1 - 0.4 * x;
  return { ok: true, score, diffMin };
}

function surfaceScore(matchSurface, oddsSurface) {
  const a = normalizeSurface(matchSurface);
  const b = normalizeSurface(oddsSurface);
  if (!a || !b) return 0.5;
  return a === b ? 1 : 0;
}

function tournamentScore(matchTour, oddsTour) {
  const a = normalizeTournament(matchTour);
  const b = normalizeTournament(oddsTour);
  if (!a || !b) return 0.5;
  return stringSimilarity(a, b);
}

function round4(x) {
  return Math.round((x + Number.EPSILON) * 10000) / 10000;
}

function summarizeRejects(rejected = []) {
  const map = new Map();
  for (const r of rejected) {
    const k = safeStr(r?.reason || "unknown");
    map.set(k, (map.get(k) || 0) + 1);
  }
  const arr = Array.from(map.entries()).map(([reason, count]) => ({ reason, count }));
  arr.sort((a, b) => b.count - a.count);
  return arr.slice(0, 8);
}

/**
 * Default: match all matches to odds list (greedy, collision-safe, fail-closed).
 */
export default function matchOddsToMatches(matches = [], oddsList = [], opts = {}) {
  const o = { ...DEFAULT_OPTS, ...(opts || {}) };
  const aliases = o.aliases || {};

  const out = { byMatchId: {}, pairs: [], rejected: [] };

  if (!Array.isArray(matches) || !Array.isArray(oddsList) || !matches.length || !oddsList.length) {
    if (o.enableDiagnostics) out.rejected.push({ reason: "empty_input", score: 0 });
    // Snapshot even here (useful to see odds=0 cases)
    if (__ODDS_DEBUG) {
      diagSnapshot("matchOddsToMatches(empty_input)", {
        matchCount: Array.isArray(matches) ? matches.length : 0,
        oddsCount: Array.isArray(oddsList) ? oddsList.length : 0,
        matchedCount: 0,
        topRejects: summarizeRejects(out.rejected),
        samplePairs: [],
      });
    }
    return out;
  }

  const normMatches = matches
    .map((m) => {
      const f = extractMatchFields(m);
      const nm1 = normalizeName(f.p1, aliases);
      const nm2 = normalizeName(f.p2, aliases);
      const startMs = parseTimeToEpochMs(f.start);
      return {
        raw: m,
        id: safeStr(f.id),
        p1: nm1,
        p2: nm2,
        tour: safeStr(f.tournament),
        surface: safeStr(f.surface),
        startMs,
      };
    })
    .filter((m) => m.id && m.p1 && m.p2);

  const normOdds = oddsList
    .map((od) => {
      const f = extractOddsFields(od);
      const no1 = normalizeName(f.p1, aliases);
      const no2 = normalizeName(f.p2, aliases);
      const startMs = parseTimeToEpochMs(f.start);
      return {
        raw: od,
        id: safeStr(f.id) || "",
        p1: no1,
        p2: no2,
        tour: safeStr(f.tournament),
        surface: safeStr(f.surface),
        startMs,
      };
    })
    .filter((x) => x.p1 && x.p2);

  if (!normMatches.length || !normOdds.length) {
    if (o.enableDiagnostics) out.rejected.push({ reason: "no_normalizable_rows", score: 0 });
    diagSnapshot("matchOddsToMatches(no_normalizable_rows)", {
      matchCount: normMatches.length,
      oddsCount: normOdds.length,
      matchedCount: 0,
      topRejects: summarizeRejects(out.rejected),
      samplePairs: [],
    });
    return out;
  }

  const candidates = [];

  for (const m of normMatches) {
    let best = null;

    for (const od of normOdds) {
      const { score: nameScore, swapped } = computeNameScore(m.p1, m.p2, od.p1, od.p2, o.allowSwapPlayers);
      if (nameScore < o.minNameScore) continue;

      const ts = timeScore(m.startMs, od.startMs, o.maxTimeWindowMinutes);
      if (!ts.ok) continue;

      const tourScore = tournamentScore(m.tour, od.tour);
      const sScore = surfaceScore(m.surface, od.surface);

      const total = 0.62 * nameScore + 0.18 * ts.score + 0.14 * tourScore + 0.06 * sScore;
      if (total < o.minTotalScore) continue;

      const row = {
        matchId: m.id,
        oddsId: od.id || "(no-odds-id)",
        score: total,
        nameScore,
        tourScore,
        timeDiffMin: Number.isFinite(ts.diffMin) ? ts.diffMin : NaN,
        swapped,
        _odds: od,
      };

      if (!best || row.score > best.score) best = row;
    }

    if (best) candidates.push(best);
    else if (o.enableDiagnostics) out.rejected.push({ matchId: m.id, reason: "no_candidate_above_threshold", score: 0 });
  }

  if (!candidates.length) {
    diagSnapshot("matchOddsToMatches(no_candidates)", {
      matchCount: normMatches.length,
      oddsCount: normOdds.length,
      matchedCount: 0,
      topRejects: summarizeRejects(out.rejected),
      samplePairs: [],
    });
    return out;
  }

  candidates.sort((a, b) => b.score - a.score);

  const usedOdds = new Set();
  for (const c of candidates) {
    const oddsKey = c._odds.id ? `id:${c._odds.id}` : `obj:${String(normOdds.indexOf(c._odds))}`;
    if (usedOdds.has(oddsKey)) {
      if (o.enableDiagnostics) {
        out.rejected.push({
          matchId: c.matchId,
          oddsId: c.oddsId,
          reason: "odds_collision_lost",
          score: c.score,
          nameScore: c.nameScore,
        });
      }
      continue;
    }

    usedOdds.add(oddsKey);
    out.byMatchId[c.matchId] = c._odds.raw;
    out.pairs.push({
      matchId: c.matchId,
      oddsId: c.oddsId,
      score: round4(c.score),
      nameScore: round4(c.nameScore),
      tourScore: round4(c.tourScore),
      timeDiffMin: Number.isFinite(c.timeDiffMin) ? Math.round(c.timeDiffMin * 10) / 10 : NaN,
      swapped: c.swapped,
    });
  }

  // Snapshot (only first 2 times total per runtime)
  diagSnapshot("matchOddsToMatches(snapshot)", {
    matchCount: normMatches.length,
    oddsCount: normOdds.length,
    matchedCount: out.pairs.length,
    topRejects: summarizeRejects(out.rejected),
    samplePairs: out.pairs.slice(0, 8),
  });

  return out;
}

/**
 * Named export expected by existing code.
 * Returns the single best odds object for ONE live match (or null if no safe match).
 */
export function findBestOddsForLiveMatch(liveMatch, oddsList = [], opts = {}) {
  const match = liveMatch || null;
  if (!match) return null;

  const matchId = safeStr(match?.id ?? match?.matchId ?? match?.match_id ?? match?.eventId ?? match?.key ?? "");
  if (!matchId) return null;

  const res = matchOddsToMatches([match], Array.isArray(oddsList) ? oddsList : [], { ...opts, enableDiagnostics: false });
  return res?.byMatchId?.[matchId] ?? null;
}