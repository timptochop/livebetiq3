// src/utils/fetchTennisLive.js
// Ενιαίο helper για τα endpoints του Vercel

// ---- ΛΙΣΤΑ LIVE/PREGAME ----
export async function fetchTennisPredictions() {
  const res = await fetch('/api/gs/tennis-predictions', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const matches = Array.isArray(json?.matches) ? json.matches : [];
  return matches;
}

// ---- ΜΟΝΟ LIVE (όχι απαραίτητο για την οθόνη, το κρατάμε για χρήση) ----
export async function fetchTennisLive() {
  const res = await fetch('/api/gs/tennis-live', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // server μας γυρνά { matches: [...] } ήδη normalized
  return Array.isArray(json?.matches) ? json.matches : [];
}

// Προαιρετικό default (ώστε παλιές import default να μην σπάνε)
export default fetchTennisPredictions;