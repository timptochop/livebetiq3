// src/utils/fetchTennisLive.js
// relative path για να αποφεύγουμε CORS σε Vercel previews
const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const resp = await fetch(BASE_URL, { method: 'GET' });
    if (!resp.ok) {
      console.error('[fetchTennisLive] HTTP', resp.status, resp.statusText);
      return [];
    }
    const data = await resp.json();
    const arr = Array.isArray(data?.matches) ? data.matches : [];
    return arr;
  } catch (e) {
    console.error('[fetchTennisLive] Error:', e);
    return [];
  }
}