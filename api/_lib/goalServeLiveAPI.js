// /api/_lib/goalServeLiveAPI.js
import axios from 'axios';
import xml2js from 'xml2js';

const GOALSERVE_URL = 'https://www.goalserve.com/getfeed/tennis?json=1';
const GOALSERVE_KEY = process.env.GOALSERVE_KEY || 'YOUR_GOALSERVE_KEY';

export default async function fetchLiveTennis() {
  const url = `https://www.goalserve.com/getfeed/${GOALSERVE_KEY}/tennis_scores/home/?json=1`;

  try {
    const response = await axios.get(url, {
      responseType: 'text',
    });

    const rawData = response.data;

    console.log('[GS-DEBUG] Raw XML response:', rawData.slice(0, 300));

    // Try to parse raw response
    let parsed = null;
    try {
      parsed = await xml2js.parseStringPromise(rawData, { explicitArray: false });
    } catch (parseError) {
      console.error('[GS-ERROR] XML parsing failed:', parseError.message);
      return { matches: [] };
    }

    // Optional: Log root keys
    console.log('[GS-DEBUG] Parsed root keys:', Object.keys(parsed));

    // Navigate to matches
    const events = parsed?.scores?.category || [];
    const matches = [];

    for (const category of Array.isArray(events) ? events : [events]) {
      const tournament = category.$?.name || 'Unknown Tournament';

      const matchesList = category.match || [];
      for (const match of Array.isArray(matchesList) ? matchesList : [matchesList]) {
        const home = match?.player?.[0]?._ || match?.player?.[0];
        const away = match?.player?.[1]?._ || match?.player?.[1];
        const status = match?.status || '';
        const time = match?.time || '';
        const id = match?.id || '';
        const odds = match?.odds || null;

        matches.push({
          id,
          tournament,
          home,
          away,
          status,
          time,
          odds,
          raw: match,
        });
      }
    }

    console.log(`[GS-DEBUG] Total matches fetched: ${matches.length}`);

    return { matches };
  } catch (err) {
    console.error('[GS-ERROR] Fetch failed:', err.message);
    return { matches: [] };
  }
}