// Στέλνει push σε ΜΙΑ subscription που δίνεται στο body
// Body: { subscription, title, body, url }
// Απαιτεί env: WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, PUSH_CONTACT

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
      } catch {
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

  const PUB = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const PRIV = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const CONTACT = process.env.PUSH_CONTACT;

  if (!PUB || !PRIV || !CONTACT) {
    return bad(res, 500, 'Missing VAPID envs', {
      have: { PUB: !!PUB, PRIV: !!PRIV, CONTACT: !!CONTACT }
    });
  }

  try {
    const { subscription, title, body, url } = await readJson(req);
    if (!subscription || !subscription.endpoint) {
      return bad(res, 400, 'Invalid subscription payload');
    }

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(CONTACT, PUB, PRIV);

    const payload = JSON.stringify({
      title: title || 'LiveBet IQ',
      body: body || 'Test push',
      data: { url: url || '/' }
    });

    const start = Date.now();
    const result = await webpush.sendNotification(subscription, payload);
    const ms = Date.now() - start;

    // result.statusCode μπορεί να είναι 201. Αν 410 => expired
    return ok(res, 200, {
      ok: true,
      statusCode: result.statusCode || 200,
      elapsedMs: ms
    });
  } catch (err) {
    // χειρισμός γνωστών περιπτώσεων
    const e = err || {};
    const detail = {
      name: e.name,
      message: e.message,
      statusCode: e.statusCode,
      headers: e.headers
    };
    const code = e.statusCode === 410 ? 410 : 500;
    return bad(res, code, 'Notify failed', detail);
  }
}