// Lockfiles built on Windows often omit Linux @rollup/* bindings after npm ci.
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const rollupPkgPath = require.resolve('rollup/package.json');
const rollupPkg = require(rollupPkgPath);
const { optionalDependencies = {} } = rollupPkg;

const { platform, arch } = process;

/** @returns {string | null} */
function nativePackageName() {
  if (platform === 'linux') {
    return `@rollup/rollup-linux-${arch}-gnu`;
  }
  if (platform === 'darwin') {
    return `@rollup/rollup-darwin-${arch}`;
  }
  if (platform === 'win32') {
    return `@rollup/rollup-win32-${arch}-msvc`;
  }
  return null;
}

const nativePkg = nativePackageName();
if (!nativePkg || !optionalDependencies[nativePkg]) {
  process.exit(0);
}

try {
  require.resolve(nativePkg);
  process.exit(0);
} catch {
  // missing optional native binding
}

const version = optionalDependencies[nativePkg];
console.log(`Installing missing Rollup native module ${nativePkg}@${version}`);
execSync(`npm install --no-save --no-audit --no-fund ${nativePkg}@${version}`, {
  stdio: 'inherit',
});
