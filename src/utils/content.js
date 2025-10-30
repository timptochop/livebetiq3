// src/utils/content.js
// v4.3 — hard-quiet insights (no console output anywhere)

const INSIGHTS_WHITELIST = [
  'localhost',
  '127.0.0.1',
  'livebetiq3.vercel.app',
  // Vercel preview domains (both patterns)
  /\.vercel\.app$/i,
  /-git-.*\.vercel\.app$/i,
  /-tim-ptochopoulos-projects\.vercel\.app$/i,
];

// -------- core helpers --------
function getHost() {
  try {
    if (typeof window !== 'undefined' && window.location) {
      return String(window.location.hostname || '').trim();
    }
    if (typeof global !== 'undefined' && global.process && process.env.VERCEL_URL) {
      return String(process.env.VERCEL_URL).replace(/^https?:\/\//, '').trim();
    }
    return '';
  } catch {
    return '';
  }
}

function matches(pattern, host) {
  if (!host) return false;
  if (typeof pattern === 'string') return pattern === host;
  if (pattern instanceof RegExp) return pattern.test(host);
  return false;
}

export function isInsightsWhitelisted(hostname = getHost()) {
  return INSIGHTS_WHITELIST.some((p) => matches(p, hostname));
}

export function insightsConfig() {
  const host = getHost();
  const enabled = isInsightsWhitelisted(host);
  // expose minimal runtime flags (read-only)
  try {
    if (typeof window !== 'undefined' && !window.__LBQ_INSIGHTS__) {
      Object.defineProperty(window, '__LBQ_INSIGHTS__', {
        value: Object.freeze({ host, enabled }),
        writable: false,
        configurable: false,
        enumerable: true,
      });
    }
  } catch {
    // ignore
  }
  return { host, enabled };
}

// backwards-compat shim used by older modules
export function validateInsightsHost() {
  // we still compute it, but we DO NOT log anything
  const { enabled } = insightsConfig();
  return enabled;
}

// auto-run once at import
validateInsightsHost();

export default {
  isInsightsWhitelisted,
  insightsConfig,
  validateInsightsHost,
};