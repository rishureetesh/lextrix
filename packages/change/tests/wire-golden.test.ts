/**
 * Golden wire fixtures — deterministic compatibility vectors (ADR-012).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseChangeProposalWire,
  parseChangeSet,
  parseCollabEnvelope,
  parseDocumentVersion,
  serializeChangeProposal,
  serializeChangeSet,
  serializeCollabEnvelope,
  serializeDocumentVersion,
  WIRE_SCHEMA_VERSION,
} from '../src/wire/index.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'wire');

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(dir, name), 'utf8'));
}

describe('ADR-012 golden vectors', () => {
  it('changeset-empty', () => {
    const raw = load('changeset-empty.json');
    const cs = parseChangeSet(raw);
    expect(cs.ops).toEqual([]);
    expect(serializeChangeSet(cs).schemaVersion).toBe(WIRE_SCHEMA_VERSION);
  });

  it('changeset-mixed', () => {
    const raw = load('changeset-mixed.json') as { ops: unknown[] };
    const cs = parseChangeSet(raw);
    expect(cs.ops).toEqual(raw.ops);
    expect(serializeChangeSet(cs).ops).toEqual(raw.ops);
  });

  it('proposal-ai', () => {
    const raw = load('proposal-ai.json') as {
      id: string;
      meta: { source: string; confidence?: number };
    };
    const p = parseChangeProposalWire(raw);
    expect(p.id).toBe(raw.id);
    expect(p.meta.source).toBe('ai');
    expect(p.meta.confidence).toBe(0.75);
    expect(p.meta.untrustedInput).toBe(true);
    const again = serializeChangeProposal(p);
    expect(again.kind).toBe('proposal');
    expect(again.change.ops).toEqual(p.change.ops);
  });

  it('version-root and version-child lineage', () => {
    const root = parseDocumentVersion(load('version-root.json'));
    const child = parseDocumentVersion(load('version-child.json'));
    expect(root.parentId).toBeNull();
    expect(root.changeFromParent).toBeNull();
    expect(child.parentId).toBe(root.id);
    expect(child.changeFromParent).not.toBeNull();
    const rebuilt = root.contents.compose(child.changeFromParent!);
    expect(JSON.stringify(rebuilt.ops)).toBe(
      JSON.stringify(child.contents.ops),
    );
    expect(serializeDocumentVersion(child).changeFromParent).not.toBeNull();
  });

  it('collab-envelope', () => {
    const env = parseCollabEnvelope(load('collab-envelope.json'));
    expect(env.changeId).toBe('chg_golden_1');
    expect(env.dependsOn).toEqual([]);
    expect(serializeCollabEnvelope(env).kind).toBe('collab-envelope');
  });
});
