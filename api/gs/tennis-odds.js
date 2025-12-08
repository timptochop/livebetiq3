// api/gs/tennis-odds.js
// LiveBet IQ – GoalServe Tennis Odds proxy (v1.0)

const zlib = require('zlib');

module.exports = async function handler(req, res) {
  // Simple HEAD/health handling
  if (req.method === 'HEAD') {
    res.status(204).end();
    return;
  }

  const token = process.env.GOALSERVE_TOKEN || '';

  // Explicit healthcheck mode: /api/gs/tennis-odds?health=1
  if (req.query && req.query.health === '1') {
    res.status(200).json({
      ok: true,
      message: 'tennis-odds healthcheck',
      hasToken: !!token,
      envKeys: ['GOALSERVE_TOKEN'],
    });
    return;
  }

  if (!token) {
    res.status(500).json({
      ok: false,
      error: 'missing-goalserve-token',
    });
    return;
  }

  // Base GoalServe odds endpoint
  const baseUrl = `https://www.goalserve.com/getfeed/${token}/getodds/soccer`;

  // Build querystring
  const qs = new URLSearchParams();

  // Mandatory tennis odds category
  qs.set('cat', 'tennis_10');

  // Try JSON output; αν δεν επιστρέψει JSON, θα κάνουμε fallback σε raw text
  qs.set('json', '1');

  // Pass-through φίλτρα αν τα στείλουμε από το frontend
  const allowedFilters = [
    'date_start',
    'date_end',
    'bm',      // bookmaker filter
    'market',
    'league',
    'match',
    'ts',      // incremental updates
  ];

  for (const key of allowedFilters) {
    const v = req.query && req.query[key];
    if (typeof v === 'string' && v.trim() !== '') {
      qs.set(key, v.trim());
    }
  }

  const url = `${baseUrl}?${qs.toString()}`;

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        // Ζητάμε JSON, αλλά δεχόμαστε και XML/άλλο ώστε να μην σκάει
        Accept: 'application/json, text/xml;q=0.9, */*;q=0.8',
      },
    });

    if (!upstream.ok) {
      const bodySnippet = await upstream
        .text()
        .then((t) => t.slice(0, 500))
        .catch(() => '');

      res.status(502).json({
        ok: false,
        error: 'upstream-not-ok',
        status: upstream.status,
        url,
        bodySnippet,
      });
      return;
    }

    const encoding = (upstream.headers.get('content-encoding') || '').toLowerCase();

    let text;
    if (encoding.includes('gzip')) {
      // Handle gzipped odds feed explicitly
      const buf = Buffer.from(await upstream.arrayBuffer());
      text = zlib.gunzipSync(buf).toString('utf8');
    } else {
      text = await upstream.text();
    }

    // First προσπάθεια: JSON parse (αν παίζει το json=1)
    try {
      const data = JSON.parse(text);

      res.status(200).json({
        ok: true,
        source: 'goalserve-tennis-odds',
        url,
        // προσπαθούμε να δώσουμε ένα μικρό summary count αν γίνεται
        count: Array.isArray(data?.odds)
          ? data.odds.length
          : Array.isArray(data?.matches)
          ? data.matches.length
          : undefined,
        data,
      });
      return;
    } catch (e) {
      // Fallback: δεν είναι JSON → δίνουμε raw text πίσω για inspect
      res.status(200).json({
        ok: true,
        source: 'goalserve-tennis-odds',
        url,
        format: 'text',
        raw: text.slice(0, 20000), // κόβουμε για ασφάλεια
      });
      return;
    }
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'handler-exception',
      message: String(err),
    });
  }
};