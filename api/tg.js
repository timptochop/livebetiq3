// api/tg.js
export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID' });
  }

  try {
    let text = '';
    if (req.method === 'POST') {
      const body = await readJson(req);
      text = (body && body.text) ? String(body.text) : '';
    } else if (req.method === 'GET') {
      text = String(req.query?.text || 'ping');
    } else {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'Empty text' });
    }

    const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    const r = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!data.ok) {
      return res.status(502).json({ ok: false, error: 'Telegram error', detail: data });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Unknown error' });
  }
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => {
      try { resolve(JSON.parse(s || '{}')); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}