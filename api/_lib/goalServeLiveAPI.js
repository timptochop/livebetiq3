// File: api/_lib/goalServeLiveAPI.js
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

const GOALSERVE_URL = 'http://www.goalserve.com/getfeed/f31155052f6749178f8808dde8bc3095/tennis_scores/home?json=1';

export async function fetchLiveTennis() {
  try {
    const response = await fetch(GOALSERVE_URL, {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.scores || !data.scores.category) {
      console.warn('[GoalServe] Empty or unexpected structure:', data);
      return [];
    }

    const categories = Array.isArray(data.scores.category)
      ? data.scores.category
      : [data.scores.category];

    const matches = [];

    for (const category of categories) {
      const events = category.event || [];
      for (const match of events) {
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
          raw: match, // keep original data for debug if needed
        });
      }
    }

    return matches;
  } catch (error) {
    console.error('[GoalServe] fetchLiveTennis error:', error);
    return [];
  }
}