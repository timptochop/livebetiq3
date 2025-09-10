const API_URL = 'https://livebetiq3.vercel.app/api/gs/tennis-live';

export default async function fetchTennisLive() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Failed to fetch matches');
  const data = await res.json();
  return data.matches || [];
}