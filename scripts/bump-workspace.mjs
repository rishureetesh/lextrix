import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');
const files = [
  join(repoRoot, 'package.json'),
  ...readdirSync(join(repoRoot, 'packages'))
    .map((name) => join(repoRoot, 'packages', name, 'package.json'))
    .filter((path) => existsSync(path)),
];

for (const path of files) {
  const original = readFileSync(path, 'utf8');
  const updated = original
    .replace(/"version": "2\.0\.0"/g, '"version": "2.0.1"')
    .replace(/lextrix-[a-z]+": "2\.0\.0"/g, (match) => match.replace('2.0.0', '2.0.1'))
    .replace(/"lextrix": "2\.0\.0"/g, '"lextrix": "2.0.1"');
  if (updated !== original) {
    writeFileSync(path, updated);
    console.log('updated', path.replace(repoRoot + '/', ''));
  }
}
