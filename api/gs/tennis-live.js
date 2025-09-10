// File: /api/gs/tennis-live.js
import { xml2js } from 'xml-js';

const GOALSERVE_URL = 'https://www.goalserve.com/getfeed/YOUR_KEY/tennis_scores/home';
const GZIP_HEADER = { 'Accept-Encoding': 'gzip' };

export default async function handler(req, res) {
  try {
    const apiRes = await fetch(GOALSERVE_URL, {
      method: 'GET',
      headers: GZIP_HEADER,
    });

    if (!apiRes.ok) {
      console.error('[GoalServe] ❌ Bad response:', apiRes.status);
      res.status(500).set(corsHeaders()).json({ error: 'GoalServe fetch failed' });
      return;
    }

    const xmlText = await apiRes.text();
    const json = xml2js(xmlText, { compact: true, ignoreDeclaration: true });

    const matches = extractMatches(json);

    res.status(200).set({
      'Content-Type': 'application/json',
      ...corsHeaders(),
    }).json({ matches });
  } catch (err) {
    console.error('[GoalServe] ❌ Exception:', err.message);
    res.status(500).set(corsHeaders()).json({ error: 'Fetch exception', details: err.message });
  }
}

// 🔄 Extract matches safely from GoalServe XML
function extractMatches(json) {
  try {
    const scores = json?.scores?.category;
    if (!scores) return [];

    const categories = Array.isArray(scores) ? scores : [scores];
    const matches = [];

    for (const category of categories) {
      const tournaments = category.tournament;
      const tournamentsArray = Array.isArray(tournaments) ? tournaments : [tournaments];

      for (const tournament of tournamentsArray) {
        const events = tournament?.match;
        const eventsArray = Array.isArray(events) ? events : [events];

        for (const match of eventsArray) {
          const id = match?._attributes?.id || '';
          const status = match?.status?._text || 'unknown';
          const home = match?.home?.name?._text || '';
          const away = match?.away?.name?._text || '';
          const date = match?.date?._text || '';
          const time = match?.time?._text || '';
          const score = match?.score?._text || '';
          const odds = match?.odds || {};

          matches.push({
            id,
            status,
            home,
            away,
            date,
            time,
            score,
            odds,
            raw: match, // optional: keep raw for AI debug
          });
        }
      }
    }

    return matches;
  } catch (err) {
    console.warn('[GoalServe] ⚠️ Failed to extract matches:', err.message);
    return [];
  }
}

// 🌍 Add CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}