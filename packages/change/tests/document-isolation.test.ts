/**
 * Guards Phase 1 experimental Document against accidental DOM/editor imports.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../src/experimental');

const FORBIDDEN = [
  'lextrix-dom',
  'lextrix-core',
  'lextrix-modules',
  'lextrix-formats',
  'lextrix-themes',
  'lextrix-ui',
  'from \'lextrix\'',
  'from "lextrix"',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('experimental Document isolation', () => {
  it('does not import editor/DOM packages', () => {
    const files = walk(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        expect(source.includes(token), `${file} contains ${token}`).toBe(false);
      }
      expect(source.includes('window.'), `${file} references window`).toBe(false);
      // Ban DOM document global access, not the word "Document" (our class name).
      expect(
        /\bdocument\.(createElement|getElementById|querySelector|addEventListener)\b/.test(
          source,
        ),
        `${file} references DOM document APIs`,
      ).toBe(false);
    }
  });
});