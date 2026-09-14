/**
 * Lockfiles built on Windows often omit Linux optional native bindings after
 * `npm ci` (npm/cli#4828). Root package.json pins Linux packages as
 * optionalDependencies so `npm ci` should install them; this script force-installs
 * any still-missing Rollup / unrs-resolver binding via `npm pack` (does not rely
 * on `npm install --no-save`, which is a no-op against a frozen lockfile).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const { platform, arch } = process;

/**
 * @param {string} name scoped or unscoped package name
 * @param {string} version
 */
function forceInstallFromRegistry(name, version) {
  const dest = join(rootDir, 'node_modules', ...name.split('/'));
  const staging = mkdtempSync(join(tmpdir(), 'lextrix-native-'));
  try {
    const packOut = execFileSync('npm', ['pack', `${name}@${version}`], {
      cwd: staging,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const tarball = packOut.trim().split(/\r?\n/).pop();
    if (!tarball) {
      throw new Error(`npm pack produced no tarball for ${name}@${version}`);
    }
    execFileSync('tar', ['-xzf', tarball], { cwd: staging, stdio: 'inherit' });
    const extracted = join(staging, 'package');
    if (!existsSync(extracted)) {
      throw new Error(`Expected ${extracted} after extracting ${tarball}`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    renameSync(extracted, dest);
    console.log(`Installed ${name}@${version} -> ${dest}`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * @param {string} packageJsonId
 * @param {(platform: string, arch: string) => string | null} resolveNativeName
 */
function ensureOptionalNative(packageJsonId, resolveNativeName) {
  let pkgPath;
  try {
    pkgPath = require.resolve(packageJsonId);
  } catch (err) {
    console.warn(`Skipping native ensure; cannot resolve ${packageJsonId}:`, err.message);
    return;
  }

  const pkg = require(pkgPath);
  const optionalDependencies = pkg.optionalDependencies ?? {};
  const nativePkg = resolveNativeName(platform, arch);
  if (!nativePkg || !optionalDependencies[nativePkg]) {
    return;
  }

  const version = optionalDependencies[nativePkg];
  const dest = join(rootDir, 'node_modules', ...nativePkg.split('/'));

  const isPresent = () => {
    if (!existsSync(join(dest, 'package.json'))) return false;
    try {
      require.resolve(nativePkg);
      return true;
    } catch {
      return false;
    }
  };

  if (!isPresent()) {
    console.log(`Missing ${nativePkg}; installing ${nativePkg}@${version}`);
    forceInstallFromRegistry(nativePkg, version);
  }

  if (!isPresent()) {
    throw new Error(
      `Failed to install ${nativePkg}@${version} into ${dest}. ` +
        `Contents of parent: ${readdirSync(dirname(dest)).join(', ')}`,
    );
  }
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
