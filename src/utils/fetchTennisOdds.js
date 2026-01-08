// src/utils/fetchTennisOdds.js
// Fetch tennis odds from our Vercel API route (serverless)
// Returns the raw payload (we normalize downstream)

export default async function fetchTennisOdds() {
  const url = `/api/gs/tennis-odds?ts=${Date.now()}`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json,text/plain,*/*" },
  });

  const text = await res.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      `fetchTennisOdds_failed_${res.status}`;
    throw new Error(msg);
  }

  // Support both envelopes:
  // A) { ok:true, data:{...} }
  // B) raw payload directly
  return (json && typeof json === "object" && json.data) ? json.data : json;
}