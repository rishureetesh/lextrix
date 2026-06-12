import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');
const target = process.argv[2];

if (!target) {
  console.error('Usage: node scripts/bump-workspace.mjs <version>');
  process.exit(1);
}

const rootPkgPath = join(repoRoot, 'package.json');
const from = JSON.parse(readFileSync(rootPkgPath, 'utf8')).version;

if (from === target) {
  console.log(`Already at ${target}`);
  process.exit(0);
}

const files = [
  rootPkgPath,
  ...readdirSync(join(repoRoot, 'packages'))
    .map((name) => join(repoRoot, 'packages', name, 'package.json'))
    .filter((path) => existsSync(path)),
];

const depPattern = new RegExp(`(lextrix(?:-[a-z]+)?": ")${from.replace(/\./g, '\\.')}`, 'g');

for (const path of files) {
  const original = readFileSync(path, 'utf8');
  const updated = original
    .replace(new RegExp(`"version": "${from.replace(/\./g, '\\.')}"`, 'g'), `"version": "${target}"`)
    .replace(depPattern, `$1${target}`);
  if (updated !== original) {
    writeFileSync(path, updated);
    console.log('updated', path.replace(repoRoot + '/', '').replace(repoRoot + '\\', ''));
  }
}

console.log(`Bumped workspace ${from} → ${target}. Run npm install to refresh package-lock.json.`);
