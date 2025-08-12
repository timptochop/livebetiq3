// server/telemetry.js
import { Router } from 'express';

const router = Router();

// Μικρό in-memory buffer για πρόσφατα events (δεν είναι DB)
const BUFFER_MAX = 1000;
const eventsBuffer = [];

/**
 * Υγεία endpoint, για δοκιμή:
 * GET /api/telemetry/health  -> { ok: true }
 */
router.get('/telemetry/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * Στέλνουμε telemetry:
 * POST /api/telemetry
 * body: { event: string, data?: object | primitive }
 */
router.post('/telemetry', (req, res) => {
  const { event, data } = req.body || {};

  const item = {
    ts: new Date().toISOString(),
    ip:
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null,
    ua: req.headers['user-agent'] || null,
    event: String(event || 'unknown').slice(0, 64),
    data: typeof data === 'object' && data !== null ? data : { value: data ?? null },
  };

  eventsBuffer.push(item);
  if (eventsBuffer.length > BUFFER_MAX) eventsBuffer.shift();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[telemetry]', item.event, JSON.stringify(item.data));
  }

  res.json({ ok: true });
});

/**
 * Πρόσφατα events (για γρήγορο έλεγχο ενώ αναπτύσσουμε)
 * GET /api/telemetry/latest -> { ok:true, items:[...] }
 */
router.get('/telemetry/latest', (req, res) => {
  res.json({ ok: true, items: eventsBuffer.slice(-50) });
});

export default router;