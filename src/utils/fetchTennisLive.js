// src/utils/fetchTennisLive.js
import axios from 'axios';

/**
 * Επιστρέφει απευθείας array με matches από το serverless endpoint.
 * Το LiveTennis περιμένει να καλέσει απλά: const matches = await fetchTennisLive();
 */
export default async function fetchTennisLive() {
  try {
    const { data } = await axios.get('/api/gs/tennis-predictions', {
      timeout: 15000,
      headers: { 'Cache-Control': 'no-cache' },
    });

    // Περιμένουμε shape: { matches: [...] }
    if (Array.isArray(data?.matches)) {
      return data.matches;
    }
    return [];
  } catch (error) {
    console.error('❌ fetchTennisLive error:', error?.message || error);
    return [];
  }
}