/**
 * Phase 7 — package boundary sanity (no cycles / no intelligence in change).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readPkg(name: string): { dependencies?: Record<string, string> } {
  return JSON.parse(
    readFileSync(join(root, '..', name, 'package.json'), 'utf8'),
  );
}

describe('Phase 7 package boundaries', () => {
  it('lextrix-change has no vendor/network deps and exports ports', () => {
    const pkg = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string>; exports?: Record<string, string> };
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).not.toContain('lextrix-intelligence');
    expect(deps).not.toContain('openai');
    expect(deps).not.toContain('pg');
    expect(deps).not.toContain('ws');
    expect(deps).not.toContain('redis');
    expect(pkg.exports?.['./wire']).toBeTruthy();
    expect(pkg.exports?.['./document']).toBeTruthy();
    expect(pkg.exports?.['./persistence']).toBeTruthy();
    expect(pkg.exports?.['./collaboration']).toBeTruthy();
    expect(pkg.exports?.['./experimental']).toBeTruthy();
  });

  it('persistence exports authoritative CAS port', async () => {
    const mod = await import('../src/persistence/index.js');
    expect(mod.InMemoryAuthoritativePersistence).toBeTruthy();
    expect(typeof mod.InMemoryAuthoritativePersistence).toBe('function');
  });

  it('persistence and collaboration ports have no vendor/network imports', () => {
    const persistIdx = readFileSync(
      join(root, 'src/persistence/index.ts'),
      'utf8',
    );
    const collabIdx = readFileSync(
      join(root, 'src/collaboration/index.ts'),
      'utf8',
    );
    expect(persistIdx).not.toMatch(/postgres|sqlite|mongodb|redis|fs\/promises/i);
    expect(collabIdx).not.toMatch(/websocket|http\.|node:net|ioredis/i);
  });

  it('lextrix-core does not depend on intelligence', () => {
    const pkg = readPkg('core');
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain(
      'lextrix-intelligence',
    );
  });

  it('lextrix-intelligence depends on change only (runtime)', () => {
    const pkg = readPkg('intelligence');
    expect(pkg.dependencies?.['lextrix-change']).toBeTruthy();
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['lextrix-change']);
  });
});
