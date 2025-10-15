// Global helper: από τη λίστα θα καλείς window.setLiveCount(n)
export function installLiveCountHelper() {
  window.setLiveCount = (n) => {
    const v = Number(n) || 0;
    window.__LIVE_COUNT__ = v;
    window.dispatchEvent(new CustomEvent('live-count', { detail: v }));
  };
}