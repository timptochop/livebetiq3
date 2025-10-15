// src/utils/notifyMatch.js
import { shouldNotify, markNotified } from './notifyControl';
import { registerSW, ensurePermission, getSubscription, saveSubscription, sendNotify } from '../push/pushClient';

export async function notifyMatchIfAllowed(matchId, message, opts = {}) {
  if (!shouldNotify(matchId)) return false;
  await ensurePermission();
  const reg = await registerSW();
  const sub = await getSubscription(reg);
  await saveSubscription(sub);
  const ok = await sendNotify({
    subscription: sub,
    title: opts.title || 'LiveBet IQ',
    text: message,
    url: opts.url || window.location.origin,
    tag: opts.tag || `match-${matchId}`
  });
  if (ok) markNotified(matchId);
  return ok;
}