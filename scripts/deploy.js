// CommonJS helper: bump manifest.x-build + vercel build/deploy (Windows-safe)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const pManifest = path.join(root, 'public', 'manifest.json');

function bumpManifest() {
  const j = JSON.parse(fs.readFileSync(pManifest, 'utf8'));
  const now = Date.now();
  j['x-build'] = typeof j['x-build'] === 'number' ? j['x-build'] + 1 : now;
  fs.writeFileSync(pManifest, JSON.stringify(j, null, 2));
  console.log('✔ manifest.json x-build =', j['x-build']);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}

(function main() {
  bumpManifest();
  run('npx', ['vercel', 'build', '--prod']);
  run('npx', ['vercel', 'deploy', '--prebuilt', '--prod', '--yes']);
  console.log('✅ Deployed. Κάνε hard refresh (Ctrl/Cmd+Shift+R).');
})();