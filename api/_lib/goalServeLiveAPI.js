// File: api/_lib/goalServeLiveAPI.js

import axios from 'axios';

export async function fetchLiveTennis() {
  const API_URL = 'https://www.goalserve.com/feed/sport/tennis_scores/home?json=1&key=f0ad5b615f0b4febb29408dddb0d1d39';

  try {
    const response = await axios.get(API_URL);
    const data = response.data;

    // Optionally, clean or normalize here
    const matches = data?.scores?.match || [];

    return Array.isArray(matches) ? matches : [matches];
  } catch (error) {
    console.error('[FETCH] GoalServe tennis failed:', error.message);
    throw new Error('GoalServe fetch failed');
  }
}