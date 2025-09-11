// File: /api/gs/tennis-live.js

import axios from 'axios';
import zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

export default async function handler(req, res) {
  try {
    const API_URL = 'https://www.goalserve.com/getfeed/<YOUR_KEY>/tennis_scores/home';
    
    const response = await axios.get(API_URL, {
      responseType: 'arraybuffer',
      decompress: false,
      headers: {
        'Accept-Encoding': 'gzip',
      },
    });

    const buffer = Buffer.from(response.data);
    const xmlData = zlib.gunzipSync(buffer).toString('utf-8');

    console.log('[DEBUG] XML fetched. Length:', xmlData.length);

    const json = await parseStringPromise(xmlData, { explicitArray: false });
    const events = json?.scores?.sport?.event;

    console.log('[DEBUG] Parsed events:', Array.isArray(events) ? events.length : typeof events);

    if (!events || (Array.isArray(events) && events.length === 0)) {
      console.warn('[DEBUG] No events found in GoalServe data');
      return res.status(200).json({
        matches: [
          {
            test: true,
            message: '⚠️ No events parsed from GoalServe XML',
            xmlLength: xmlData.length,
          },
        ],
      });
    }

    const matches = Array.isArray(events) ? events : [events];

    return res.status(200).json({ matches });
  } catch (error) {
    console.error('[ERROR] /api/gs/tennis-live:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch or parse GoalServe Tennis XML',
      message: error.message,
    });
  }
}