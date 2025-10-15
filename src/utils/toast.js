export function showToast(text, timeout = 3000) {
  try {
    const ev = new CustomEvent('LBQ_TOAST', { detail: { text, timeout } });
    window.dispatchEvent(ev);
  } catch {
    // fallback
    console.log('[toast]', text);
  }
}