/**
 * Phase 11 — ownership fencing + durable idempotency (in-memory + optional PG).
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentVersion } from 'lextrix-change/document';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import {
  DocumentServerSession,
  InMemoryDocumentOwnership,
  partitionForDocument,
} from 'lextrix-collab';

/** Keep ownership epoch and persistence epoch synchronized (shared durable epoch). */
class SyncedMemoryOwnership extends InMemoryDocumentOwnership {
  constructor(
    private readonly persist: InMemoryAuthoritativePersistence,
    opts: ConstructorParameters<typeof InMemoryDocumentOwnership>[0],
  ) {
    super(opts);
  }

  override async acquire(documentId: string) {
    const epoch = this.persist.bumpOwnerEpoch(documentId);
    const partition = partitionForDocument(documentId, this.partitionCount);
    if (
      this.ownedPartitions &&
      !this.ownedPartitions.has(partition)
    ) {
      throw new Error(
        `SyncedMemoryOwnership: partition ${partition} not owned by ${this.ownerId}`,
      );
    }
    return {
      documentId,
      ownerId: this.ownerId,
      ownerEpoch: epoch,
      partition,
      expiresAt: Date.now() + 30_000,
    };
  }

  override async getEpoch(documentId: string): Promise<number> {
    return this.persist.getOwnerEpoch(documentId);
  }
}

describe('Phase 11 fencing (in-memory)', () => {
  it('stale owner cannot append after new epoch', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const ownershipA = new SyncedMemoryOwnership(persist, {
      ownerId: 'A',
      partitionCount: 4,
    });
    const session = await DocumentServerSession.open(
      'doc_fence',
      { persistence: persist, ownership: ownershipA },
      { contents: new ChangeSet([{ insert: 'f\n' }]), createIfMissing: true },
    );
    const leaseA = session.getLease()!;
    expect(leaseA.ownerEpoch).toBeGreaterThan(0);

    // B takes ownership → bumps epoch
    const ownershipB = new SyncedMemoryOwnership(persist, {
      ownerId: 'B',
      partitionCount: 4,
    });
    const leaseB = await ownershipB.acquire('doc_fence');
    expect(leaseB.ownerEpoch).toBeGreaterThan(leaseA.ownerEpoch);

    // A still holds stale lease object — accept must fence
    const result = await session.accept({
      changeId: 'stale_write',
      documentId: 'doc_fence',
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'X' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('stale_owner');

    // B can write with fresh session
    const sessionB = await DocumentServerSession.open(
      'doc_fence',
      {
        persistence: persist,
        ownership: ownershipB,
        lease: leaseB,
      },
      { createIfMissing: false },
    );
    const ok = await sessionB.accept({
      changeId: 'fresh_write',
      documentId: 'doc_fence',
      baseVersionId: sessionB.getHead().id,
      change: new ChangeSet([{ insert: 'Y' }]),
      dependsOn: [],
      meta: {},
    });
    expect(ok.ok).toBe(true);
  });

  it('durable changeId survives session drop', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const ownership = new SyncedMemoryOwnership(persist, { ownerId: 'o1' });
    const s1 = await DocumentServerSession.open(
      'doc_idemp',
      { persistence: persist, ownership },
      { contents: new ChangeSet([{ insert: 'i\n' }]), createIfMissing: true },
    );
    const head = s1.getHead().id;
    const first = await s1.accept({
      changeId: 'same',
      documentId: 'doc_idemp',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 'A' }]),
      dependsOn: [],
      meta: {},
    });
    expect(first.ok).toBe(true);
    s1.close();

    const s2 = await DocumentServerSession.open(
      'doc_idemp',
      {
        persistence: persist,
        ownership,
        lease: await ownership.acquire('doc_idemp'),
      },
      { createIfMissing: false },
    );
    const second = await s2.accept({
      changeId: 'same',
      documentId: 'doc_idemp',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 'A' }]),
      dependsOn: [],
      meta: {},
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.duplicate).toBe(true);
      expect(second.version.id).toBe((first as { version: DocumentVersion }).version.id);
    }
    expect(persist.loadChain('doc_idemp')).toHaveLength(2);
  });

  it('CAS conflict when HEAD moved under session', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const ownership = new SyncedMemoryOwnership(persist, { ownerId: 'o' });
    const session = await DocumentServerSession.open(
      'doc_cas2',
      { persistence: persist, ownership },
      { contents: new ChangeSet([{ insert: 'c\n' }]), createIfMissing: true },
    );
    const head = session.getHead();
    const forged = new DocumentVersion({
      id: 'doc_cas2:v1',
      documentId: 'doc_cas2',
      sequence: 1,
      revision: 1,
      contents: new ChangeSet([{ insert: 'WIN\n' }]).freeze(),
      parentId: head.id,
      changeFromParent: new ChangeSet([{ insert: 'WIN' }]).freeze(),
      meta: null,
    });
    const cas = persist.compareAndAppend('doc_cas2', head.id, forged, {
      ownerEpoch: session.getLease()!.ownerEpoch,
    });
    expect(cas.ok).toBe(true);
    const result = await session.accept({
      changeId: 'loser2',
      documentId: 'doc_cas2',
      baseVersionId: head.id,
      change: new ChangeSet([{ insert: 'L' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
  });
});
