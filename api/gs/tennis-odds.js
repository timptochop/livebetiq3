// api/gs/tennis-odds.js
// LiveBet IQ – GoalServe Tennis Odds proxy (gzip + XML → JSON)
// v1.0-odds-proxy

const zlib = require('zlib');
const { parseStringPromise } = require('xml2js');

/**
 * Fetch raw odds feed from GoalServe (gzip-compressed XML).
 */
async function fetchRawOdds() {
  const token = process.env.GOALSERVE_TOKEN;

  if (!token) {
    throw new Error('missing GOALSERVE_TOKEN');
  }

  const url = `https://www.goalserve.com/getfeed/${token}/getodds/soccer?cat=tennis_10`;

  const resp = await fetch(url, {
    // δεν είναι υποχρεωτικό, αλλά βοηθάει να είναι καθαρό το response
    headers: {
      'Accept-Encoding': 'gzip,deflate',
      'User-Agent': 'livebetiq3-tennis-odds/1.0',
    },
  });

  if (!resp.ok) {
    throw new Error(`goalserve-http-${resp.status}`);
  }

  // παίρνουμε το raw buffer
  let buf = Buffer.from(await resp.arrayBuffer());

  // Προσπάθεια αποσυμπίεσης GZIP
  // Το feed, σύμφωνα με το manual, είναι "Feed compressed using GZIP"
  try {
    // Αν είναι ήδη gzip -> gunzipSync δουλεύει
    buf = zlib.gunzipSync(buf);
  } catch (e) {
    // Αν ΔΕΝ είναι gzip, το αφήνουμε όπως είναι (fallback)
    // π.χ. σε περίπτωση που κάποια στιγμή το επιστρέψουν plain XML
    // console.warn('tennis-odds: gunzip failed, using raw buffer', e);
  }

  const text = buf.toString('utf8').trim();

  if (!text || !text.startsWith('<')) {
    throw new Error('goalserve-odds-not-xml');
  }

  return text;
}

/**
 * Parse XML → JS object (χωρίς ιδιαίτερο normalize προς το παρόν).
 */
async function parseOddsXml(xml) {
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });

  return parsed;
}

/**
 * Vercel API handler
 */
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const xml = await fetchRawOdds();
    const data = await parseOddsXml(xml);

    // Προς το παρόν επιστρέφουμε το πλήρες αντικείμενο ως "raw",
    // για να το δούμε πρώτα στο browser / Postman και μετά να κάνουμε
    // κανονικό normalize σε επόμενο βήμα.
    res.status(200).json({
      ok: true,
      source: 'goalserve-tennis-odds',
      ts: Date.now(),
      raw: data,
    });
  } catch (err) {
    console.error('[tennis-odds] error', err);

    res.status(500).json({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
};