// scripts/topbar-bell-only.js
// Patches the TopBar to show ONLY the bell on the right, writes files, bumps cache,
// optional git add/commit, then vercel build + deploy (prebuilt).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = p => path.relative(root, p);

function writeFileUtf8(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s, 'utf8');
  console.log('✓ wrote', rel(p));
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}

// 1) Ensure /public/brand/mark.png exists (used as small logo on the left)
const markPng = path.join(root, 'public', 'brand', 'mark.png');
if (!fs.existsSync(markPng)) {
  fs.mkdirSync(path.dirname(markPng), { recursive: true });
  const fallback = path.join(root, 'public', 'logo192.png');
  fs.copyFileSync(fallback, markPng);
  console.log('✓ created', rel(markPng));
} else {
  console.log('✓ exists', rel(markPng));
}

// 2) Write TopBar component (bell only on the right)
const topbarJs = `import React, { useEffect, useState } from 'react';
import './TopBar.css';

// Events
const EVT_LIVE_COUNT = 'live-count';
const EVT_NOTIFY = 'lbq-notify-toggle';

// Persistent toggle hook
function useToggle(key, def = true) {
  const initial = (() => {
    try { const v = localStorage.getItem(key); return v === null ? def : v === '1'; }
    catch { return def; }
  })();
  const [val, setVal] = useState(initial);
  useEffect(() => { try { localStorage.setItem(key, val ? '1' : '0'); } catch {} }, [val]);
  return [val, setVal];
}

export default function TopBar({ initialLiveCount = 0 }) {
  const [liveCount, setLiveCount] = useState(Number.isFinite(window?.__LIVE_COUNT__) ? window.__LIVE_COUNT__ : initialLiveCount);
  const [notifyOn, setNotifyOn] = useToggle('lbq.notify', true);

  // listen live-count
  useEffect(() => {
    const onCount = (e) => { const n = Number(e?.detail ?? 0); if (Number.isFinite(n)) setLiveCount(n); };
    window.addEventListener(EVT_LIVE_COUNT, onCount);
    return () => window.removeEventListener(EVT_LIVE_COUNT, onCount);
  }, []);

  // broadcast notify toggle
  useEffect(() => { window.dispatchEvent(new CustomEvent(EVT_NOTIFY, { detail: notifyOn })); }, [notifyOn]);

  return (
    <div className="topbar" role="banner">
      <div className="topbar-left">
        <img className="brand-mark" src="/brand/mark.png" alt="Logo" />
        <div className="live-chip" aria-label="Live matches">
          <span className="dot" />
          <span className="label">LIVE</span>
          <span className="count">{liveCount}</span>
        </div>
      </div>

      <div className="topbar-actions" aria-label="controls">
        <button
          className={"icon-btn " + (notifyOn ? 'on' : 'off')}
          title={notifyOn ? 'Notifications: ON' : 'Notifications: OFF'}
          onClick={() => setNotifyOn(v => !v)}
          aria-pressed={notifyOn}
        >
          {/* Bell icon */}
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5L4 18v2h16v-2l-2-2Z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
`;

const topbarCss = `:root {
  --tb-bg:#0e2624;
  --tb-chip:#0f3732;
  --tb-text:#e7f5ef;
  --tb-accent:#16d37a;
}
.topbar {
  position: sticky; top: 0; z-index: 1000;
  padding: max(8px, env(safe-area-inset-top)) 12px 10px 12px;
  background: linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,0)), var(--tb-bg);
  backdrop-filter: saturate(120%) blur(6px);
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.topbar-left { display: flex; align-items: center; gap: 10px; min-height: 44px; }
.brand-mark { width: 24px; height: 24px; object-fit: contain; filter: drop-shadow(0 1px 1px rgba(0,0,0,.35)); }
.live-chip {
  display: flex; align-items: center; gap: 8px;
  background: var(--tb-chip); color: var(--tb-text);
  padding: 6px 12px; border-radius: 999px; font-weight: 800; letter-spacing: .3px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
}
.live-chip .dot {
  width: 8px; height: 8px; border-radius: 999px;
  background: var(--tb-accent); box-shadow: 0 0 10px var(--tb-accent), 0 0 2px var(--tb-accent);
}
.live-chip .label { opacity: .9; }
.live-chip .count { margin-left: 2px; font-variant-numeric: tabular-nums; }

.topbar-actions { display: flex; align-items: center; gap: 8px; }
.icon-btn {
  width: 34px; height: 34px; display: grid; place-items: center;
  border-radius: 10px; border: none; cursor: pointer;
  background: rgba(255,255,255,.06); color: #dfe; transition: .15s ease;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.05);
}
.icon-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,.10); }
.icon-btn svg { fill: #dfe; opacity: .9; }
.icon-btn.off svg { opacity: .5; }
`;

writeFileUtf8(path.join(root, 'src', 'components', 'TopBar.js'), topbarJs);
writeFileUtf8(path.join(root, 'src', 'components', 'TopBar.css'), topbarCss);

// 3) Cache-bump manifest.json so SW grabs new markup
try {
  const p = path.join(root, 'public', 'manifest.json');
  if (fs.existsSync(p)) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j['x-build'] = Date.now();
    fs.writeFileSync(p, JSON.stringify(j, null, 2), 'utf8');
    console.log('✓ cache-bump', rel(p));
  }
} catch (e) {
  console.warn('manifest bump skipped:', e?.message || e);
}

// 4) Optional git add/commit (if repo exists)
if (fs.existsSync(path.join(root, '.git'))) {
  run('git', ['add',
    'public/brand/mark.png',
    'src/components/TopBar.js',
    'src/components/TopBar.css',
    'public/manifest.json'
  ]);
  run('git', ['commit', '-m', 'TopBar: bell-only on right; cache-bump']);
}

// 5) Build & deploy (prebuilt)
run('npx', ['vercel', 'build', '--prod']);
run('npx', ['vercel', 'deploy', '--prebuilt', '--prod', '--yes']);

console.log('✅ Done. Hard refresh the site (Ctrl/Cmd+Shift+R).');