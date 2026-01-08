// src/utils/fetchTennisOdds.js
// Fetch + normalize + index tennis odds for AI
// LOCKDOWN+ safe | No UI changes required

import normalizeTennisOdds from "./normalizeTennisOdds";

function makePlayerKey(home, away) {
  const a = String(home || "").trim().toLowerCase();
  const b = String(away || "").trim().toLowerCase();
  if (!a || !b) return "";
  return `${a}__vs__${b}`;
}

export default async function fetchTennisOdds() {
  const url = "/api/gs/tennis-odds";

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  // Expecting { ok, cached, stale, ts, data }
  const ok = !!json?.ok;
  const stale = !!json?.stale;
  const ts = Number(json?.ts || 0);

  const rows = normalizeTennisOdds(json);

  // Build indexes
  const byMatchId = Object.create(null);
  const byPlayers = Object.create(null);

  for (const r of rows) {
    if (r?.matchId) byMatchId[String(r.matchId)] = r;

    const key = makePlayerKey(r?.home, r?.away);
    if (key) byPlayers[key] = r;

    // Also store reverse key (sometimes home/away swap between feeds)
    const revKey = makePlayerKey(r?.away, r?.home);
    if (revKey && !byPlayers[revKey]) byPlayers[revKey] = r;
  }

  return {
    ok,
    stale,
    ts,
    rows,
    byMatchId,
    byPlayers,
    count: rows.length,
  };
}