// src/ai/modelLoader.js
function getWebhook() {
  try { return String(process.env.LOG_WEBHOOK_URL || ''); } catch { return ''; }
}
function toModelUrl(execUrl) {
  try {
    if (!execUrl) return '';
    var u = new URL(execUrl);
    u.search = 'model=1';
    return u.toString();
  } catch { return ''; }
}
function setCutoffsLocal(c) {
  try { localStorage.setItem('LBQ_CUTOFFS', JSON.stringify(c)); } catch {}
}
function setModelLocal(m) {
  try { localStorage.setItem('LBQ_MODEL', JSON.stringify(m)); } catch {}
}
export async function loadModelAndApply() {
  try {
    const execUrl = getWebhook();
    const url = toModelUrl(execUrl);
    if (!url) return { ok: false, reason: 'no-webhook' };
    const res = await fetch(url, { method: 'GET' });
    const js = await res.json();
    if (js && js.cutoffs) {
      setCutoffsLocal(js.cutoffs);
      setModelLocal(js);
      return { ok: true, model: js };
    }
    return { ok: false, reason: 'no-cutoffs' };
  } catch {
    return { ok: false, reason: 'fetch-failed' };
  }
}
if (typeof window !== 'undefined') {
  window.LBQ = window.LBQ || {};
  window.LBQ.model = {
    refresh: () => loadModelAndApply(),
    get: () => {
      try { return JSON.parse(localStorage.getItem('LBQ_MODEL') || 'null'); }
      catch { return null; }
    },
    cutoffs: () => {
      try { return JSON.parse(localStorage.getItem('LBQ_CUTOFFS') || 'null'); }
      catch { return null; }
    }
  };
}
export default { loadModelAndApply };