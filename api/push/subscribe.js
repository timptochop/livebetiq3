// Node 22 (CJS-compatible) – Vercel Serverless Function
// Stores/validates a subscription. Εδώ για demo επιστρέφουμε ok.
// Αν θες persistence, πρόσθεσε DB/KV.

function ok(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
function bad(res, code, message, details) {
  ok(res, code, { ok: false, code, message, details: details || null });
}
function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('ERR_BAD_JSON'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return ok(res, 204, { ok: true });

  if (req.method !== 'POST') return bad(res, 405, 'Method Not Allowed');

  try {
    const body = await readJson(req);
    const sub = body && body.subscription;

    // very light validation
    if (!sub || typeof sub !== 'object' || !sub.endpoint) {
      return bad(res, 400, 'Invalid subscription payload');
    }

    // (προαιρετικά) αποθήκευση sub σε DB/KV εδώ.

    return ok(res, 200, { ok: true, message: 'subscription stored' });
  } catch (err) {
    const message = err && err.message ? err.message : 'Internal';
    return bad(res, 500, 'Subscribe failed', { message });
  }
}