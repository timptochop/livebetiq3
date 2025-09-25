// src/utils/notifyControl.js
const KEY_REPEAT = 'lbq-repeat-enabled';
const KEY_SEEN = 'lbq-notified-ids';

const mem = {
  repeat: null,
  seen: new Set(JSON.parse(localStorage.getItem(KEY_SEEN) || '[]')),
};

export function isRepeatEnabled() {
  if (mem.repeat === null) mem.repeat = localStorage.getItem(KEY_REPEAT) === '1';
  return mem.repeat;
}

export function setRepeatEnabled(v) {
  mem.repeat = !!v;
  localStorage.setItem(KEY_REPEAT, v ? '1' : '0');
}

export function toggleRepeatEnabled() {
  const v = !isRepeatEnabled();
  setRepeatEnabled(v);
  return v;
}

export function shouldNotify(id) {
  if (!id) return true;
  if (isRepeatEnabled()) return true;
  return !mem.seen.has(id);
}

export function markNotified(id) {
  if (!id) return;
  mem.seen.add(id);
  localStorage.setItem(KEY_SEEN, JSON.stringify([...mem.seen]));
}

export function resetNotified() {
  mem.seen.clear();
  localStorage.removeItem(KEY_SEEN);
}