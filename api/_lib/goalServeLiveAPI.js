// File: api/_lib/goalServeLiveAPI.js

import axios from 'axios';

export async function fetchLiveTennis() {
  const API_URL = 'https://www.goalserve.com/feed/sport/tennis_scores/home?json=1&key=f0ad5b615f0b4febb29408dddb0d1d39';

  try {
    const response = await axios.get(API_URL);
    const data = response.data;

    // 🧠 Debug το structure:
    console.log('[DEBUG] GoalServe raw data:', typeof data, Array.isArray(data), Object.keys(data || {}));

    let matches = [];

    if (Array.isArray(data?.scores)) {
      // ✅ scores is already an array of matches
      matches = data.scores;
    } else if (Array.isArray(data?.scores?.match)) {
      matches = data.scores.match;
    } else if (data?.scores?.match) {
      matches = [data.scores.match]; // single object fallback
    } else {
      console.warn('[WARNING] GoalServe API returned unexpected format:', JSON.stringify(data).slice(0, 300));
    }

    return matches;
  } catch (error) {
    console.error('[FETCH] GoalServe tennis failed:', error.message);
    return [];
  }
}