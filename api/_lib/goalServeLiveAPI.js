// File: api/_lib/goalServeLiveAPI.js
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

const GOALSERVE_URL = 'http://www.goalserve.com/getfeed/f31155052f6749178f8808dde8bc3095/tennis_scores/home/';

export async function fetchLiveTennis() {
  try {
    const response = await fetch(GOALSERVE_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const xml = await response.text();
    const result = await parseStringPromise(xml, { explicitArray: false });

    const categories = result?.scores?.category || [];
    const normalized = Array.isArray(categories) ? categories : [categories];

    const matches = [];

    for (const category of normalized) {
      const events = category.event || [];
      const eventsArray = Array.isArray(events) ? events : [events];

      for (const match of eventsArray) {
        const home = match?.home?.name || match?.home;
        const away = match?.away?.name || match?.away;
        const score = match?.score || {};
        const status = match?.status || 'Unknown';
        const tournament = category.name || 'Unknown';
        const matchId = match?.id || `${home}-${away}`;

        matches.push({
          id: matchId,
          home,
          away,
          tournament,
          status,
          score,
          raw: match,
        });
      }
    }

    console.log(`[GoalServe] Loaded ${matches.length} matches`);
    return matches;
  } catch (error) {
    console.error('[GoalServe] fetchLiveTennis error:', error);
    return [];
  }
}