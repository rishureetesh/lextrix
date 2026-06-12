import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(repoRoot, 'packages/lextrix/dist/dist');
const dryRun = process.argv.includes('--dry-run');

const run = (command, args = [], options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const rootVersion = readJson(join(repoRoot, 'package.json')).version;
const workspacePackages = readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(repoRoot, 'packages', entry.name, 'package.json'))
  .filter((path) => existsSync(path));

const mismatched = workspacePackages
  .map((path) => ({ path, version: readJson(path).version }))
  .filter(({ version }) => version !== rootVersion);

if (mismatched.length) {
  console.error('Version mismatch across workspace packages:');
  for (const { path, version } of mismatched) {
    console.error(`  ${path}: ${version} (expected ${rootVersion})`);
  }
  process.exit(1);
}

console.log(`pre-publish: verifying ${rootVersion}`);

run('npm', ['run', 'typecheck']);
run('npm', ['run', 'test', '-w', 'lextrix-change']);
run('npm', ['run', 'test', '-w', 'lextrix-serialize']);
run('npm', ['run', 'test', '-w', 'lextrix-core']);
run('npm', ['run', 'test:unit', '-w', 'lextrix']);
run('npm', ['run', 'build']);
run('node', ['scripts/verify-markdown-escape.mjs']);

const distPkgPath = join(distDir, 'package.json');
if (!existsSync(distPkgPath)) {
  console.error(`Missing publish package: ${distPkgPath}`);
  process.exit(1);
}

const distVersion = readJson(distPkgPath).version;
if (distVersion !== rootVersion) {
  console.error(`dist package version ${distVersion} != workspace ${rootVersion}`);
  process.exit(1);
}

const requiredArtifacts = [
  'lextrix.d.ts',
  'lextrix.core.d.ts',
  'lextrix.js',
  'lextrix.esm.js',
  'lextrix.core.js',
  'lextrix.core.esm.js',
  'lextrix.core.css',
  'lextrix.snow.css',
  'README.md',
  'LICENSE',
  'NOTICE.md',
];

for (const file of requiredArtifacts) {
  const path = join(distDir, file);
  if (!existsSync(path)) {
    console.error(`Missing publish artifact: ${file}`);
    process.exit(1);
  }
}

run('npm', ['pack', ...(dryRun ? ['--dry-run'] : [])], { cwd: distDir });

console.log(dryRun ? 'pre-publish dry-run passed' : 'pre-publish checks passed');
