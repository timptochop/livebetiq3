// /api/gs/tennis-live.js (Vercel Edge Function)
import zlib from 'zlib';
import { promisify } from 'util';
import https from 'https';
import { parseStringPromise } from 'xml2js';

const gunzip = promisify(zlib.gunzip);

const GOALSERVE_KEY = process.env.GOALSERVE_KEY || 'f31155052f6749178f8808dde8bc3095';
const GS_URL = `https://www.goalserve.com/getfeed/${GOALSERVE_KEY}/tennis_scores/home`;

export default async function handler(req, res) {
  try {
    const xmlBuffer = await fetchGzipXML(GS_URL);
    const xmlText = xmlBuffer.toString('utf8');
    const parsed = await parseStringPromise(xmlText, { explicitArray: false });

    const categories = parsed?.scores?.category || [];
    const normalizedMatches = [];

    const categoryList = Array.isArray(categories) ? categories : [categories];

    for (const category of categoryList) {
      const tournament = category?.$?.name || 'Unknown Tournament';
      const matches = category.match || [];

      const matchList = Array.isArray(matches) ? matches : [matches];

      for (const match of matchList) {
        normalizedMatches.push({
          id: match?.id || '',
          tournament,
          home: match?.player?.[0]?._ || match?.player?.[0],
          away: match?.player?.[1]?._ || match?.player?.[1],
          status: match?.status || '',
          time: match?.time || '',
          odds: match?.odds || null,
          raw: match,
        });
      }
    }

    console.log(`[GS] ✅ Loaded ${normalizedMatches.length} matches`);
    res.status(200).json({ matches: normalizedMatches });
  } catch (err) {
    console.error('[GS-ERROR]', err);
    res.status(500).json({ matches: [], error: err.message });
  }
}

// Helper to fetch and decompress gzip XML
async function fetchGzipXML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
      const chunks = [];

      const encoding = res.headers['content-encoding'];
      const isGzip = encoding === 'gzip';

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        try {
          const decoded = isGzip ? await gunzip(buffer) : buffer;
          resolve(decoded);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}