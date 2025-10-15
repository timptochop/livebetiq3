// src/utils/getMatchId.js
export function getMatchId(m = {}) {
  return (
    m.id ||
    m.matchId ||
    `${(m.name || `${m.players?.[0]?.name} vs ${m.players?.[1]?.name}` || 'match')
       .replace(/\s+/g,' ')}|${m.date || m['@date'] || ''}|${m.time || m['@time'] || ''}`
  );
}