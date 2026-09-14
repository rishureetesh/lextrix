/**
 * Document ownership / fencing contracts (ADR-025).
 * Lease store for reference = PostgreSQL (via server adapter) or in-memory.
 */
export interface DocumentOwnershipLease {
  documentId: string;
  ownerId: string;
  ownerEpoch: number;
  partition: number;
  /** Absolute expiry time (ms since epoch), if applicable. */
  expiresAt?: number;
}

export interface DocumentOwnership {
  acquire(documentId: string): Promise<DocumentOwnershipLease>;
  renew(lease: DocumentOwnershipLease): Promise<boolean>;
  release(lease: DocumentOwnershipLease): Promise<void>;
  /** Current durable epoch for fencing checks (may be 0). */
  getEpoch(documentId: string): Promise<number>;
}

export interface PartitionConfig {
  /** Configurable partition count — not hard-coded into document semantics. */
  partitionCount: number;
}

export function partitionForDocument(
  documentId: string,
  partitionCount: number,
): number {
  if (partitionCount <= 0) {
    throw new Error('partitionCount must be > 0');
  }
  let h = 2166136261;
  for (let i = 0; i < documentId.length; i += 1) {
    h ^= documentId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % partitionCount;
}

/**
 * In-process ownership for tests / single-node. Not multi-instance safe alone.
 */
export class InMemoryDocumentOwnership implements DocumentOwnership {
  private readonly epochs = new Map<string, number>();
  private readonly owners = new Map<string, DocumentOwnershipLease>();
  readonly ownerId: string;
  readonly partitionCount: number;
  /** Partitions this owner is responsible for (empty = all). */
  readonly ownedPartitions: ReadonlySet<number> | null;

  constructor(options: {
    ownerId: string;
    partitionCount?: number;
    ownedPartitions?: readonly number[];
  }) {
    this.ownerId = options.ownerId;
    this.partitionCount = options.partitionCount ?? 16;
    this.ownedPartitions =
      options.ownedPartitions == null
        ? null
        : new Set(options.ownedPartitions);
  }

  async acquire(documentId: string): Promise<DocumentOwnershipLease> {
    const partition = partitionForDocument(documentId, this.partitionCount);
    if (
      this.ownedPartitions &&
      !this.ownedPartitions.has(partition)
    ) {
      throw new Error(
        `InMemoryDocumentOwnership: partition ${partition} not owned by ${this.ownerId}`,
      );
    }
    const epoch = (this.epochs.get(documentId) ?? 0) + 1;
    this.epochs.set(documentId, epoch);
    const lease: DocumentOwnershipLease = {
      documentId,
      ownerId: this.ownerId,
      ownerEpoch: epoch,
      partition,
      expiresAt: Date.now() + 30_000,
    };
    this.owners.set(documentId, lease);
    return lease;
  }

  async renew(lease: DocumentOwnershipLease): Promise<boolean> {
    const current = this.owners.get(lease.documentId);
    if (
      !current ||
      current.ownerId !== lease.ownerId ||
      current.ownerEpoch !== lease.ownerEpoch
    ) {
      return false;
    }
    current.expiresAt = Date.now() + 30_000;
    return true;
  }

  async release(lease: DocumentOwnershipLease): Promise<void> {
    const current = this.owners.get(lease.documentId);
    if (
      current &&
      current.ownerId === lease.ownerId &&
      current.ownerEpoch === lease.ownerEpoch
    ) {
      this.owners.delete(lease.documentId);
    }
  }

  async getEpoch(documentId: string): Promise<number> {
    return this.epochs.get(documentId) ?? 0;
  }
}
