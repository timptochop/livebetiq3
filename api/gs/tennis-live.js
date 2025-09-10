// api/gs/tennis-live.js
import { NextResponse } from 'next/server';
import zlib from 'zlib';
import { promisify } from 'util';
import { parseStringPromise } from 'xml2js';

const gunzip = promisify(zlib.gunzip);

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const API_KEY = process.env.GOALSERVE_KEY || 'f04d5b615f0b4febb29408dddb0d1d39';
  const url = `https://www.goalserve.com/getfeed/${API_KEY}/tennis_scores/home`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Encoding': 'gzip',
      },
    });

    if (!response.ok) {
      return new NextResponse(
        JSON.stringify({ error: 'Failed to fetch from GoalServe' }),
        {
          status: 500,
          headers: corsHeaders(),
        }
      );
    }

    const buffer = await response.arrayBuffer();
    const decompressed = await gunzip(Buffer.from(buffer));
    const xml = decompressed.toString('utf-8');
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    const matches = [];

    if (parsed && parsed.scores && parsed.scores.category) {
      const categories = Array.isArray(parsed.scores.category)
        ? parsed.scores.category
        : [parsed.scores.category];

      categories.forEach((cat) => {
        if (!cat.match) return;

        const events = Array.isArray(cat.match) ? cat.match : [cat.match];

        events.forEach((match) => {
          matches.push({
            id: match.id,
            home: match.player1,
            away: match.player2,
            status: match.status,
            score: match.score,
            odds: match.odds,
            tournament: cat.name,
            date: match.date,
            time: match.time,
          });
        });
      });
    }

    return new NextResponse(JSON.stringify({ matches }), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err) {
    console.error('API error:', err);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}