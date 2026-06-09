import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/lextrix/dist/dist/lextrix.esm.js',
);

const bundle = readFileSync(dist, 'utf8');

if (bundle.includes('#+\\\\-.!') || bundle.includes('#+\\-.!')) {
  console.error('FAIL: published bundle still uses over-aggressive markdown escape (includes . !)');
  process.exit(1);
}

console.log('OK: bundle does not contain legacy markdown escape pattern');
