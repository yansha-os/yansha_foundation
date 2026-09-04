const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const artifactsDir = path.join(rootDir, 'release-artifacts');

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const packages = ['contracts', 'platform', 'ui'];

for (const pkg of packages) {
  const pkgDir = path.join(rootDir, 'packages', pkg);
  console.log(`Packaging @yansha/${pkg}...`);
  execSync(`npm pack --pack-destination "${artifactsDir}"`, {
    cwd: pkgDir,
    stdio: 'inherit'
  });
}

console.log('Build & release packaging complete. Artifacts in release-artifacts/');
