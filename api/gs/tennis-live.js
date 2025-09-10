// src/utils/fetchTennisLive.js
const API_URL = process.env.REACT_APP_API_URL || 'https://livebetiq3.vercel.app/api/gs/tennis-live';

/**
 * Fetches live and upcoming tennis matches from the backend API.
 * This is used by LiveTennis.js to load matches with AI predictions.
 */
export default async function fetchTennisLive() {
  try {
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.error(`❌ fetchTennisLive error: ${res.status} ${res.statusText}`);
      return { matches: [] };
    }

    const data = await res.json();

    // Basic validation
    if (!data || !Array.isArray(data.matches)) {
      console.warn('⚠️ Invalid response structure from /api/gs/tennis-live');
      return { matches: [] };
    }

    return data;
  } catch (error) {
    console.error('❌ fetchTennisLive() failed:', error);
    return { matches: [] };
  }
}