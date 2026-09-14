/**
 * Ambiguous commit resolution: never invent a second Version.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/document';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';

describe('Phase 11 ambiguous commit', () => {
  it('resolves via loadHead + changeId lookup before retry', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
      documentId: 'amb',
    });
    persist.setOwnerEpoch('amb', 1);
    const root = handle.currentVersion();
    expect(
      persist.compareAndAppend('amb', null, root, { ownerEpoch: 1 }).ok,
    ).toBe(true);

    handle.apply(new ChangeSet([{ insert: 'x' }]));
    const v1 = handle.currentVersion();
    // Simulate: commit succeeded but client never saw ACK
    const committed = persist.compareAndAppend('amb', root.id, v1, {
      ownerEpoch: 1,
      changeId: 'amb_chg',
    });
    expect(committed.ok).toBe(true);

    // Ambiguous recovery path
    const byChange = persist.lookupChangeId('amb', 'amb_chg');
    const head = persist.loadHead('amb');
    expect(byChange?.versionId).toBe(v1.id);
    expect(head?.id).toBe(v1.id);

    // Retry same changeId → idempotent, no new Version
    const retry = persist.compareAndAppend('amb', root.id, v1, {
      ownerEpoch: 1,
      changeId: 'amb_chg',
    });
    expect(retry.ok && retry.duplicate).toBe(true);
    expect(persist.loadChain('amb')).toHaveLength(2);
  });
});
