// File: api/_lib/goalServeLiveAPI.js
import axios from 'axios';
import zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

const GOALSERVE_KEY = process.env.GOALSERVE_KEY || 'f31155052f6749178f8808dde8bc3095';
const GOALSERVE_URL = `https://www.goalserve.com/getfeed/tennis_scores/home/?key=${GOALSERVE_KEY}`;

export async function fetchLiveTennis() {
  try {
    const response = await axios.get(GOALSERVE_URL, {
      responseType: 'arraybuffer',
      decompress: false,
    });

    const buffer = Buffer.from(response.data);
    const decompressed = zlib.gunzipSync(buffer);
    const xml = decompressed.toString('utf8');

    const json = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });

    const categories = json?.scores?.category || [];
    const categoryList = Array.isArray(categories) ? categories : [categories];

    const matches = [];

    for (const category of categoryList) {
      const tournament = category.name || 'Unknown Tournament';
      const matchList = category.match || [];

      const matchArray = Array.isArray(matchList) ? matchList : [matchList];

      for (const match of matchArray) {
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

    console.log(`[GS] ✅ Parsed ${matches.length} matches`);
    return { matches };
  } catch (err) {
    console.error('[GS-ERROR] Failed to fetch or parse GoalServe Tennis feed:', err.message);
    if (err.response) {
      console.error('[GS-ERROR] Response:', err.response.status, err.response.statusText);
    }
    return { matches: [] };
  }
}