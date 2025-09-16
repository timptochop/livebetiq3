// src/utils/fetchTennisLive.js
// Προσπαθεί πρώτα predictions (με AI), αλλιώς κάνει fallback σε live.

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default async function fetchTennisLive() {
  const CANDIDATES = [
    '/api/gs/tennis-predictions', // έχει prediction.label
    '/api/gs/tennis-live',        // fallback χωρίς AI (ή PENDING)
  ];

  for (const url of CANDIDATES) {
    try {
      const data = await getJSON(url);
      const arr = Array.isArray(data?.matches) ? data.matches : Array.isArray(data) ? data : [];
      return arr;
    } catch (e) {
      // try next
    }
  }
  return [];
}