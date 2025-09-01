// src/utils/fetchTennisLive.js

// Δοκιμάζει πρώτα predictions. Αν αποτύχει ή είναι κενό, πέφτει σε live
export async function fetchTennisPredictions() {
  try {
    const res = await fetch('/api/gs/tennis-predictions', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const matches = Array.isArray(json?.matches) ? json.matches : [];
    if (matches.length > 0) return matches;
    // αν ήρθαν άδειες, πέφτουμε σε live
    return await fallbackLive();
  } catch {
    return await fallbackLive();
  }
}

async function fallbackLive() {
  const res = await fetch('/api/gs/tennis-live', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const base = Array.isArray(json?.matches) ? json.matches : [];
  // Προσθέτουμε ελάχιστο prediction ώστε η UI να είναι συνεπής
  return base.map((m) => ({
    ...m,
    prediction: {
      label: 'PENDING',
      pick: null,
      confidence: 0,
      source: 'fallback',
      detail: 'set1_pending',
    },
  }));
}

// Προαιρετικό helper: μόνο τα live (αν χρειαστεί αλλού)
export async function fetchTennisLive() {
  const res = await fetch('/api/gs/tennis-live', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.matches) ? json.matches : [];
}

export default fetchTennisPredictions;