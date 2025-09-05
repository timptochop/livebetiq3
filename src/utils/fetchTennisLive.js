const API_URL = 'https://livebetiq3.vercel.app/api/gs/tennis-live'; // Vercel-only endpoint

export default async function fetchTennisLive() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      console.error(`Fetch failed with status ${res.status}`);
      return { matches: [] };
    }

    const json = await res.json();
    if (!json || !Array.isArray(json.matches)) {
      console.warn('Invalid API response format:', json);
      return { matches: [] };
    }

    return { matches: json.matches };
  } catch (err) {
    console.error('Fetch error:', err.message || err);
    return { matches: [] };
  }
}