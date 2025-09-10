// src/utils/fetchTennisLive.js
const API_URL = 'https://livebetiq3.vercel.app/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`[fetchTennisLive] HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    if (!data || !Array.isArray(data.matches)) {
      throw new Error('[fetchTennisLive] Invalid API response structure');
    }

    return data.matches;
  } catch (error) {
    console.error('[fetchTennisLive] Network/API Error:', error);
    return []; // fallback empty array
  }
}