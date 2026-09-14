/**
 * Lockfiles built on Windows often omit Linux optional native bindings after
 * `npm ci`. Install platform-specific Rollup + unrs-resolver bindings when missing
 * (eslint-import-resolver-typescript depends on unrs-resolver).
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { platform, arch } = process;

/**
 * @param {string} packageJsonId
 * @param {(platform: string, arch: string) => string | null} resolveNativeName
 */
function ensureOptionalNative(packageJsonId, resolveNativeName) {
  let pkgPath;
  try {
    pkgPath = require.resolve(packageJsonId);
  } catch {
    return;
  }

  const pkg = require(pkgPath);
  const optionalDependencies = pkg.optionalDependencies ?? {};
  const nativePkg = resolveNativeName(platform, arch);
  if (!nativePkg || !optionalDependencies[nativePkg]) {
    return;
  }

  try {
    require.resolve(nativePkg);
    return;
  } catch {
    // missing optional native binding
  }

  const version = optionalDependencies[nativePkg];
  console.log(`Installing missing native module ${nativePkg}@${version}`);
  execSync(`npm install --no-save --no-audit --no-fund ${nativePkg}@${version}`, {
    stdio: 'inherit',
  });
}

ensureOptionalNative('rollup/package.json', (plat, cpu) => {
  if (plat === 'linux') return `@rollup/rollup-linux-${cpu}-gnu`;
  if (plat === 'darwin') return `@rollup/rollup-darwin-${cpu}`;
  if (plat === 'win32') return `@rollup/rollup-win32-${cpu}-msvc`;
  return null;
});

ensureOptionalNative('unrs-resolver/package.json', (plat, cpu) => {
  if (plat === 'linux') return `@unrs/resolver-binding-linux-${cpu}-gnu`;
  if (plat === 'darwin') return `@unrs/resolver-binding-darwin-${cpu}`;
  if (plat === 'win32') return `@unrs/resolver-binding-win32-${cpu}-msvc`;
  return null;
});
