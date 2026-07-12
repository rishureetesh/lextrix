import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Publish a package from a dist directory outside npm workspace resolution.
 * Using `npm publish --prefix` from the monorepo root fails: workspaces resolve
 * the private root package named "lextrix" instead of the dist package.json.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const relativeDir = process.argv[2];

if (!relativeDir) {
  console.error('Usage: node scripts/publish-package.mjs <relative-dist-dir>');
  process.exit(1);
}

const distDir = resolve(repoRoot, relativeDir);
const pkgPath = join(distDir, 'package.json');

if (!existsSync(pkgPath)) {
  console.error(`Missing package.json at ${pkgPath}. Run build first.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.private) {
  console.error(`${pkgPath} is marked private — refusing to publish.`);
  process.exit(1);
}

console.log(`Publishing ${pkg.name}@${pkg.version} from ${distDir}`);

const result = spawnSync(
  'npm',
  ['publish', '--access', 'public'],
  {
    cwd: distDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
