// File: src/utils/fetchTennisLive.js v0.96.14-debug
export default async function fetchTennisLive() {
  try {
    const res = await fetch('https://livebetiq3.vercel.app/api/gs/tennis-live');
    const data = await res.json();

    console.log('🎯 [fetchTennisLive] Response status:', res.status);
    console.log('🎯 [fetchTennisLive] Matches:', data.matches?.length);
    console.table((data.matches || []).map(m => ({
      id: m.id || m['@id'],
      status: m.status || m['@status'],
      player1: m?.player?.[0]?.name || m?.players?.[0]?.name,
      player2: m?.player?.[1]?.name || m?.players?.[1]?.name,
    })));

    return Array.isArray(data.matches) ? data.matches : [];
  } catch (e) {
    console.warn('[fetchTennisLive] API Error:', e.message);
    return [];
  }
}