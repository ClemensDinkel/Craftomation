const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'release');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean previous release
if (fs.existsSync(RELEASE_DIR)) {
  fs.rmSync(RELEASE_DIR, { recursive: true });
}
fs.mkdirSync(RELEASE_DIR);

console.log('[Release] Assembling release...');

// 1. Copy backend compiled JS
copyDir(
  path.join(ROOT, 'packages/backend/dist'),
  path.join(RELEASE_DIR, 'server')
);

// 2. Copy CSV data files
copyDir(
  path.join(ROOT, 'packages/backend/src/data'),
  path.join(RELEASE_DIR, 'data')
);
// Only keep CSV files in data/
for (const f of fs.readdirSync(path.join(RELEASE_DIR, 'data'))) {
  if (!f.endsWith('.csv')) {
    fs.rmSync(path.join(RELEASE_DIR, 'data', f), { recursive: true });
  }
}

// 3. Copy frontend build
copyDir(
  path.join(ROOT, 'packages/frontend/dist'),
  path.join(RELEASE_DIR, 'public')
);

// 4. Create package.json with only runtime dependencies (no shared)
const backendPkg = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/backend/package.json'), 'utf-8')
);
const deps = { ...backendPkg.dependencies };
delete deps['@craftomation/shared'];

const releasePkg = {
  name: 'craftomation',
  version: backendPkg.version || '1.0.0',
  private: true,
  scripts: {
    start: 'node server/index.js',
  },
  dependencies: deps,
};
fs.writeFileSync(
  path.join(RELEASE_DIR, 'package.json'),
  JSON.stringify(releasePkg, null, 2) + '\n'
);

// 5. Install production dependencies into the release folder
console.log('[Release] Installing production dependencies...');
execSync('npm install --omit=dev', { cwd: RELEASE_DIR, stdio: 'inherit' });

// 6. Copy shared package directly into node_modules (after npm install, so it won't be pruned)
const sharedTarget = path.join(RELEASE_DIR, 'node_modules', '@craftomation', 'shared');
fs.mkdirSync(sharedTarget, { recursive: true });
copyDir(
  path.join(ROOT, 'packages/shared/dist'),
  path.join(sharedTarget, 'dist')
);
fs.writeFileSync(
  path.join(sharedTarget, 'package.json'),
  JSON.stringify({ name: '@craftomation/shared', version: '1.0.0', main: 'dist/index.js' }, null, 2) + '\n'
);

// 7. Remove package-lock.json (not needed for end user, prevents npm install temptation)
const lockFile = path.join(RELEASE_DIR, 'package-lock.json');
if (fs.existsSync(lockFile)) fs.rmSync(lockFile);

// 8. Create start scripts — no npm install needed, everything is included
fs.writeFileSync(
  path.join(RELEASE_DIR, 'start.bat'),
  '@echo off\r\n' +
  'echo Starting Craftomation...\r\n' +
  'echo.\r\n' +
  'where node >nul 2>nul\r\n' +
  'if errorlevel 1 (\r\n' +
  '  echo ERROR: Node.js is not installed or not in PATH.\r\n' +
  '  echo Download it from https://nodejs.org\r\n' +
  '  pause\r\n' +
  '  exit /b 1\r\n' +
  ')\r\n' +
  'echo.\r\n' +
  'node server/index.js\r\n' +
  'echo.\r\n' +
  'echo Server stopped.\r\n' +
  'pause\r\n'
);
fs.writeFileSync(
  path.join(RELEASE_DIR, 'start.sh'),
  '#!/bin/sh\necho "Starting Craftomation..."\nnode server/index.js\n',
  { mode: 0o755 }
);

console.log('[Release] Done! Output in: release/');
console.log('[Release] Just run start.bat (Windows) or start.sh (Mac/Linux) — no npm install needed.');
