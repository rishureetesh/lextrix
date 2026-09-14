/**
 * In-memory AuthoritativeDocumentPersistence — tests/reference only (ADR-021/023).
 * NOT a production durable store. CAS is atomic only within this process.
 */
import { DocumentVersion } from '../experimental/version.js';
import { PersistenceError } from './errors.js';
import type {
  AuthoritativeDocumentPersistence,
  CompareAndAppendOptions,
  CompareAndAppendResult,
} from './authority-types.js';
import { InMemoryDocumentPersistence } from './memory.js';

function cloneVersion(version: DocumentVersion): DocumentVersion {
  return new DocumentVersion({
    id: version.id,
    documentId: version.documentId,
    sequence: version.sequence,
    revision: version.revision,
    contents: version.contents.clone().freeze(),
    parentId: version.parentId,
    changeFromParent:
      version.changeFromParent == null
        ? null
        : version.changeFromParent.clone().freeze(),
    meta: version.meta == null ? null : { ...version.meta },
  });
}

function versionPayloadKey(v: DocumentVersion): string {
  return JSON.stringify({
    id: v.id,
    documentId: v.documentId,
    sequence: v.sequence,
    revision: v.revision,
    parentId: v.parentId,
    contents: v.contents.ops,
    changeFromParent: v.changeFromParent?.ops ?? null,
    meta: v.meta,
  });
}

export class InMemoryAuthoritativePersistence
  implements AuthoritativeDocumentPersistence
{
  private readonly byDoc = new Map<string, DocumentVersion[]>();
  private readonly byId = new Map<string, DocumentVersion>();
  private readonly epochs = new Map<string, number>();
  private readonly changeIds = new Map<string, string>(); // `${doc}\0${changeId}` → versionId
  readonly legacy: InMemoryDocumentPersistence;

  constructor() {
    this.legacy = new InMemoryDocumentPersistence();
  }

  getOwnerEpoch(documentId: string): number {
    return this.epochs.get(documentId) ?? 0;
  }

  /** Test/helper: set durable epoch (simulates ownership bump). */
  setOwnerEpoch(documentId: string, epoch: number): void {
    this.epochs.set(documentId, epoch);
  }

  bumpOwnerEpoch(documentId: string): number {
    const next = this.getOwnerEpoch(documentId) + 1;
    this.epochs.set(documentId, next);
    return next;
  }

  loadHead(documentId: string): DocumentVersion | null {
    const chain = this.byDoc.get(documentId);
    if (!chain || chain.length === 0) return null;
    return chain[chain.length - 1]!;
  }

  loadVersion(
    documentId: string,
    versionId: string,
  ): DocumentVersion | null {
    const v = this.byId.get(versionId);
    if (!v || v.documentId !== documentId) return null;
    return v;
  }

  loadChain(
    documentId: string,
    fromVersionId?: string,
  ): readonly DocumentVersion[] {
    const chain = this.byDoc.get(documentId) ?? [];
    if (fromVersionId == null) {
      return Object.freeze([...chain]);
    }
    const idx = chain.findIndex((v) => v.id === fromVersionId);
    if (idx < 0) {
      throw new PersistenceError(
        'not_found',
        `InMemoryAuthoritativePersistence: unknown fromVersionId ${fromVersionId}`,
      );
    }
    return Object.freeze(chain.slice(idx + 1));
  }

  lookupChangeId(
    documentId: string,
    changeId: string,
  ): { versionId: string } | null {
    const versionId = this.changeIds.get(`${documentId}\0${changeId}`);
    return versionId == null ? null : { versionId };
  }

  compareAndAppend(
    documentId: string,
    expectedHeadId: string | null,
    version: DocumentVersion,
    options: CompareAndAppendOptions = {},
  ): CompareAndAppendResult {
    if (version.documentId !== documentId) {
      return {
        ok: false,
        reason: 'invalid_argument',
        durableHead: this.loadHead(documentId),
        message: 'version.documentId mismatch',
      };
    }

    if (options.ownerEpoch != null) {
      const durableEpoch = this.getOwnerEpoch(documentId);
      if (options.ownerEpoch !== durableEpoch) {
        return {
          ok: false,
          reason: 'stale_owner',
          durableHead: this.loadHead(documentId),
          message: `stale owner_epoch: got ${options.ownerEpoch}, durable ${durableEpoch}`,
        };
      }
    }

    if (options.changeId) {
      const prior = this.lookupChangeId(documentId, options.changeId);
      if (prior) {
        const priorV = this.loadVersion(documentId, prior.versionId);
        if (priorV) {
          return {
            ok: true,
            version: priorV,
            head: this.loadHead(documentId) ?? priorV,
            duplicate: true,
          };
        }
      }
    }

    const chain = this.byDoc.get(documentId) ?? [];
    const durableHead = chain.length === 0 ? null : chain[chain.length - 1]!;
    const durableHeadId = durableHead?.id ?? null;

    if (durableHeadId !== expectedHeadId) {
      return {
        ok: false,
        reason: 'cas_conflict',
        durableHead,
        message: `CAS conflict: expected ${String(expectedHeadId)}, durable ${String(durableHeadId)}`,
      };
    }

    const existing = this.byId.get(version.id);
    if (existing) {
      if (versionPayloadKey(existing) === versionPayloadKey(version)) {
        if (options.changeId) {
          this.changeIds.set(`${documentId}\0${options.changeId}`, existing.id);
        }
        return { ok: true, version: existing, head: existing, duplicate: true };
      }
      return {
        ok: false,
        reason: 'idempotency_conflict',
        durableHead,
        message: `conflicting Version id ${version.id}`,
      };
    }

    if (expectedHeadId == null) {
      if (version.sequence !== 0 || version.parentId != null) {
        return {
          ok: false,
          reason: 'invalid_argument',
          durableHead: null,
          message: 'root Version must be sequence 0 with null parent',
        };
      }
    } else {
      if (version.parentId !== expectedHeadId) {
        return {
          ok: false,
          reason: 'invalid_argument',
          durableHead,
          message: `parentId must equal expectedHeadId ${expectedHeadId}`,
        };
      }
      if (durableHead && version.sequence !== durableHead.sequence + 1) {
        return {
          ok: false,
          reason: 'invalid_argument',
          durableHead,
          message: `expected sequence ${durableHead.sequence + 1}`,
        };
      }
    }

    const stored = cloneVersion(version);
    const next = [...chain, stored];
    this.byDoc.set(documentId, next);
    this.byId.set(stored.id, stored);
    if (options.changeId) {
      this.changeIds.set(`${documentId}\0${options.changeId}`, stored.id);
    }
    if (!this.epochs.has(documentId)) {
      this.epochs.set(documentId, 0);
    }
    try {
      this.legacy.appendVersion(stored);
    } catch {
      /* legacy mirror best-effort */
    }
    return { ok: true, version: stored, head: stored };
  }

  clear(): void {
    this.byDoc.clear();
    this.byId.clear();
    this.epochs.clear();
    this.changeIds.clear();
    this.legacy.clear();
  }

  /**
   * Drop hot Versions with sequence &lt; beforeSequence (after archive).
   * Keeps sealed checkpoint and newer.
   */
  removeHotBeforeSequence(documentId: string, beforeSequence: number): void {
    const chain = this.byDoc.get(documentId) ?? [];
    const kept: DocumentVersion[] = [];
    for (const v of chain) {
      if (v.sequence < beforeSequence) {
        this.byId.delete(v.id);
      } else {
        kept.push(v);
      }
    }
    this.byDoc.set(documentId, kept);
  }
}
