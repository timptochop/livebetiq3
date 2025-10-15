// src/utils/sendTg.js
export default async function sendTg(text) {
  try {
    const q = new URLSearchParams({ text: String(text || '') });
    const res = await fetch(`/api/tg?${q.toString()}`, { method: 'GET' });
    // optional: const data = await res.json();
  } catch (e) {
    // σιωπηλά fail — δεν επηρεάζει UI
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[tg] send failed:', e?.message);
    }
  }
}