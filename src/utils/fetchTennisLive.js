// src/utils/fetchTennisLive.js
const BASE_URL = '/api/gs/tennis-live'; // ✅ relative path for CORS-safe fetch

export default async function fetchTennisLive() {
  try {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[fetchTennisLive] Network response was not ok:', response.statusText);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data.matches)) {
      console.warn('[fetchTennisLive] Unexpected response structure:', data);
      return [];
    }

    return data.matches;
  } catch (error) {
    console.error('[fetchTennisLive] API Error:', error);
    return [];
  }
}