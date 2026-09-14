/**
 * Mutable Document handle — single authoritative apply path for sessions
 * (editor bridge, Node pipelines). Holds linear version history (Phase 3).
 * Phase 8: stable session ownership + observers (ADR-016 / ADR-017).
 */
import ChangeSet from '../change/change-set.js';
import {
  normalizeChangeMeta,
  type ChangeMeta,
} from './change-meta.js';
import {
  createDocument,
  Document,
  type CreateDocumentOptions,
  type DocumentApplyOptions,
} from './document.js';
import { DocumentError } from './document-error.js';
import type {
  DocumentChangeEvent,
  DocumentChangeEventType,
  DocumentChangeListener,
} from './document-event.js';
import {
  DocumentTransaction,
  type TransactionCommitOptions,
  type TransactionCommitResult,
} from './transaction.js';
import { LinearVersionStore } from './version-store.js';
import {
  DocumentVersion,
  diffVersions,
} from './version.js';
import {
  createAnchor,
  DocumentAnchor,
  type CreateAnchorOptions,
} from './anchor.js';
import {
  createRange,
  DocumentRange,
  type CreateRangeOptions,
} from './range.js';
import {
  changesBetween as changesBetweenVersions,
  rebaseProposal as rebaseProposalOnStore,
} from './rebase.js';
import {
  ChangeProposal,
  createChangeProposal,
  ProposalError,
  type CreateChangeProposalOptions,
  type ProposalInspectResult,
  type ProposalValidationResult,
} from './proposal.js';
import {
  DocumentReference,
  referenceFromRange,
} from './reference.js';
import {
  DEFAULT_DOCUMENT_SCHEMA,
  type DocumentSchema,
} from './schema.js';
import { validateVersionChain } from './validate-version-chain.js';

export interface DocumentHandleApplyOptions extends DocumentApplyOptions {
  meta?: Partial<ChangeMeta>;
}

export interface CommitTransactionResult extends TransactionCommitResult {
  /** Document after apply (same as before when empty). */
  document: Document;
  /** Version after commit (unchanged when empty). */
  version: DocumentVersion;
}

export interface AcceptProposalResult {
  document: Document;
  version: DocumentVersion;
  proposal: ChangeProposal;
  /** True when change was empty and no new version was created. */
  empty: boolean;
}

export type RejectProposalResult = {
  proposal: ChangeProposal;
  rejected: true;
};

export interface HydrateDocumentHandleOptions {
  schema?: DocumentSchema;
  /** Schema-validate HEAD contents (default true). */
  validate?: boolean;
  /**
   * Verify parent.contents ∘ changeFromParent ≡ child.contents (default true).
   * Set false only for trusted in-process chains — unsafe for untrusted persistence.
   */
  verifyComposeIntegrity?: boolean;
  /**
   * Hot window after compaction: first Version may have sequence ≠ 0.
   */
  compactedRoot?: boolean;
}

/**
 * Holds the current DocumentState pointer + linear Version history.
 * Nested transactions are rejected while one is open.
 */
export class DocumentHandle {
  private current: Document;
  private openTx: DocumentTransaction | null = null;
  private lastMeta: ChangeMeta | null = null;
  private readonly versions: LinearVersionStore;
  private readonly listeners: DocumentChangeListener[] = [];
  /** True while inside apply/restore/replace mutation (reentrancy guard). */
  private mutating = false;
  /** True while notifying observers (reentrancy guard). */
  private notifying = false;

  constructor(document: Document, store?: LinearVersionStore) {
    this.current = document;
    if (store) {
      this.versions = store;
    } else {
      this.versions = new LinearVersionStore(document.documentId);
      this.versions.recordRoot(document.contents, document.revision);
    }
  }

  static create(options: CreateDocumentOptions = {}): DocumentHandle {
    return new DocumentHandle(createDocument(options));
  }

  /**
   * Hydrate a Handle from an already-linear Version chain (persistence aid).
   * Validates lineage + compose integrity by default (ADR-018).
   */
  static fromVersions(
    versions: readonly DocumentVersion[],
    options: HydrateDocumentHandleOptions = {},
  ): DocumentHandle {
    validateVersionChain(versions, {
      verifyComposeIntegrity: options.verifyComposeIntegrity,
      compactedRoot: options.compactedRoot,
    });
    const store = LinearVersionStore.hydrate(versions, {
      skipValidation: true,
    });
    const head = store.current();
    const schema = options.schema ?? DEFAULT_DOCUMENT_SCHEMA;
    const doc = new Document(
      head.contents.clone().freeze(),
      schema,
      head.revision,
      head.meta,
      head.documentId,
      head.id,
    );
    if (options.validate !== false) {
      const result = doc.validate();
      if (!result.ok) {
        throw new DocumentError(
          'hydration_error',
          `DocumentHandle.fromVersions: invalid document (${result.issues.join('; ')})`,
        );
      }
    }
    return new DocumentHandle(doc, store);
  }

  get document(): Document {
    return this.current;
  }

  get revision(): number {
    return this.current.revision;
  }

  get documentId(): string {
    return this.current.documentId;
  }

  getContents(): ChangeSet {
    return this.current.getContents();
  }

  getLastMeta(): ChangeMeta | null {
    return this.lastMeta;
  }

  /**
   * Subscribe to future non-empty committed transitions (ADR-017).
   * Duplicate subscription of the same function delivers twice.
   * Returns an idempotent unsubscribe.
   */
  subscribe(listener: DocumentChangeListener): () => void {
    if (typeof listener !== 'function') {
      throw new DocumentError(
        'invalid_argument',
        'DocumentHandle.subscribe: listener must be a function',
      );
    }
    this.listeners.push(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Current immutable Version (head of linear chain). */
  currentVersion(): DocumentVersion {
    return this.versions.current();
  }

  getVersion(id: string): DocumentVersion {
    try {
      return this.versions.getById(id);
    } catch {
      throw new DocumentError(
        'unknown_version',
        `Unknown version id: ${id}`,
      );
    }
  }

  getVersionBySequence(sequence: number): DocumentVersion {
    try {
      return this.versions.getBySequence(sequence);
    } catch {
      throw new DocumentError(
        'unknown_version',
        `Unknown version sequence: ${sequence}`,
      );
    }
  }

  listVersions(): readonly DocumentVersion[] {
    return this.versions.list();
  }

  /**
   * ChangeSet transforming versionA → versionB (same document).
   */
  diffVersions(
    versionA: DocumentVersion | string,
    versionB: DocumentVersion | string,
  ): ChangeSet {
    const a =
      typeof versionA === 'string' ? this.getVersion(versionA) : versionA;
    const b =
      typeof versionB === 'string' ? this.getVersion(versionB) : versionB;
    return this.versions.diff(a, b);
  }

  createAnchor(
    index: number,
    options: CreateAnchorOptions = {},
    version: DocumentVersion = this.currentVersion(),
  ): DocumentAnchor {
    if (version.documentId !== this.documentId) {
      throw new DocumentError(
        'wrong_document',
        'createAnchor: version belongs to another document',
      );
    }
    this.getVersion(version.id);
    return createAnchor(version, index, options);
  }

  mapAnchor(
    anchor: DocumentAnchor,
    toVersion: DocumentVersion | string,
  ): DocumentAnchor {
    const target =
      typeof toVersion === 'string' ? this.getVersion(toVersion) : toVersion;
    const from = this.getVersion(anchor.versionId);
    const change = diffVersions(from, target);
    return anchor.mapThrough(change, target);
  }

  createRange(
    start: number,
    end: number,
    options: CreateRangeOptions = {},
    version: DocumentVersion = this.currentVersion(),
  ): DocumentRange {
    if (version.documentId !== this.documentId) {
      throw new DocumentError(
        'wrong_document',
        'createRange: version belongs to another document',
      );
    }
    this.getVersion(version.id);
    return createRange(version, start, end, options);
  }

  mapRange(
    range: DocumentRange,
    toVersion: DocumentVersion | string,
  ): DocumentRange {
    const target =
      typeof toVersion === 'string' ? this.getVersion(toVersion) : toVersion;
    const from = this.getVersion(range.start.versionId);
    const change = diffVersions(from, target);
    return range.mapThrough(change, target);
  }

  createReference(
    range: DocumentRange,
    _version?: DocumentVersion,
  ): DocumentReference {
    return referenceFromRange(range);
  }

  mapReference(
    reference: DocumentReference,
    toVersion: DocumentVersion | string,
  ): DocumentReference {
    const target =
      typeof toVersion === 'string' ? this.getVersion(toVersion) : toVersion;
    if (reference.documentId !== this.documentId) {
      throw new DocumentError(
        'wrong_document',
        'mapReference: reference belongs to another document',
      );
    }
    const from = this.getVersion(reference.versionId);
    const change = diffVersions(from, target);
    return reference.mapThrough(change, target);
  }

  createProposal(
    change: ChangeSet,
    options: Omit<
      CreateChangeProposalOptions,
      'documentId' | 'baseVersionId' | 'change'
    > & { baseVersionId?: string } = {},
  ): ChangeProposal {
    return createChangeProposal({
      documentId: this.documentId,
      baseVersionId: options.baseVersionId ?? this.currentVersion().id,
      change,
      meta: options.meta,
      id: options.id,
      createdAt: options.createdAt,
    });
  }

  changesBetween(
    base: DocumentVersion | string,
    target: DocumentVersion | string,
  ): ChangeSet[] {
    return changesBetweenVersions(this.versions, base, target);
  }

  rebaseProposal(
    proposal: ChangeProposal,
    targetVersion: DocumentVersion | string = this.currentVersion(),
  ): ChangeProposal {
    return rebaseProposalOnStore(this.versions, proposal, targetVersion);
  }

  rebaseThenAccept(proposal: ChangeProposal): AcceptProposalResult {
    const rebased = this.rebaseProposal(proposal, this.currentVersion());
    return this.acceptProposal(rebased);
  }

  validateProposal(proposal: ChangeProposal): ProposalValidationResult {
    if (this.openTx) {
      return {
        ok: false,
        code: 'transaction_open',
        message: 'Cannot validate proposal while a transaction is open',
      };
    }
    if (proposal.documentId !== this.documentId) {
      return {
        ok: false,
        code: 'wrong_document',
        message: `Proposal document ${proposal.documentId} ≠ ${this.documentId}`,
      };
    }
    try {
      this.versions.getById(proposal.baseVersionId);
    } catch {
      return {
        ok: false,
        code: 'unknown_version',
        message: `Unknown base version ${proposal.baseVersionId}`,
      };
    }
    if (proposal.baseVersionId !== this.currentVersion().id) {
      return {
        ok: false,
        code: 'stale',
        message: `Proposal base ${proposal.baseVersionId} is stale; current is ${this.currentVersion().id}`,
      };
    }
    try {
      this.current.apply(proposal.change, { validate: true });
    } catch (err) {
      return {
        ok: false,
        code: 'invalid_change',
        message: err instanceof Error ? err.message : String(err),
      };
    }
    return { ok: true };
  }

  inspectProposal(proposal: ChangeProposal): ProposalInspectResult {
    if (this.openTx) {
      return {
        ok: false,
        code: 'transaction_open',
        message: 'Cannot inspect proposal while a transaction is open',
      };
    }
    if (proposal.documentId !== this.documentId) {
      return {
        ok: false,
        code: 'wrong_document',
        message: `Proposal document ${proposal.documentId} ≠ ${this.documentId}`,
      };
    }
    let base: DocumentVersion;
    try {
      base = this.versions.getById(proposal.baseVersionId);
    } catch {
      return {
        ok: false,
        code: 'unknown_version',
        message: `Unknown base version ${proposal.baseVersionId}`,
      };
    }
    try {
      const baseDoc = new Document(
        base.contents,
        this.current.schema,
        base.revision,
        null,
        this.documentId,
        base.id,
      );
      baseDoc.apply(proposal.change, { validate: true });
    } catch (err) {
      return {
        ok: false,
        code: 'invalid_change',
        message: err instanceof Error ? err.message : String(err),
      };
    }
    const head = this.currentVersion();
    return {
      ok: true,
      stale: proposal.baseVersionId !== head.id,
      baseVersionId: proposal.baseVersionId,
      headVersionId: head.id,
    };
  }

  acceptProposal(proposal: ChangeProposal): AcceptProposalResult {
    const validation = this.validateProposal(proposal);
    if (!validation.ok) {
      throw new ProposalError(validation.code, validation.message);
    }
    const beforeId = this.currentVersion().id;
    const beforeCount = this.listVersions().length;
    try {
      if (proposal.change.length() === 0) {
        return {
          document: this.current,
          version: this.currentVersion(),
          proposal,
          empty: true,
        };
      }
      this.apply(proposal.change, {
        meta: proposal.meta,
        validate: true,
      });
      return {
        document: this.current,
        version: this.currentVersion(),
        proposal,
        empty: false,
      };
    } catch (err) {
      // Observer failure after commit is expected (ADR-017) — do not wrap as invariant break.
      if (err instanceof DocumentError && err.code === 'observer_failed') {
        throw err;
      }
      if (
        this.currentVersion().id !== beforeId ||
        this.listVersions().length !== beforeCount
      ) {
        throw new DocumentError(
          'invalid_state',
          `acceptProposal invariant broken after failure: ${String(err)}`,
          { cause: err },
        );
      }
      throw err;
    }
  }

  rejectProposal(proposal: ChangeProposal): RejectProposalResult {
    return { proposal, rejected: true };
  }

  restoreVersion(version: DocumentVersion | string): DocumentVersion {
    const target =
      typeof version === 'string' ? this.getVersion(version) : version;
    if (target.documentId !== this.documentId) {
      throw new DocumentError(
        'wrong_document',
        'restoreVersion: version belongs to another document',
      );
    }
    // String path requires hot history; DocumentVersion object may be archived.
    if (typeof version === 'string') {
      this.getVersion(target.id);
    }
    const change = this.current.contents.diff(target.contents);
    if (change.length() === 0) {
      return this.currentVersion();
    }
    this.applyInternal(
      change,
      {
        meta: {
          source: 'system',
          origin: 'system',
          intent: 'restore-version',
          restoredFrom: target.id,
        },
        validate: true,
      },
      'restored',
    );
    return this.currentVersion();
  }

  apply(
    change: ChangeSet,
    options: DocumentHandleApplyOptions = {},
  ): Document {
    return this.applyInternal(change, options, 'applied');
  }

  replaceFromContents(
    contents: ChangeSet,
    options: { validate?: boolean; meta?: Partial<ChangeMeta> } = {},
  ): Document {
    this.assertNotReentrant();
    if (this.openTx) {
      throw new DocumentError(
        'transaction_open',
        'DocumentHandle.replaceFromContents: transaction is open',
      );
    }
    const meta = normalizeChangeMeta(options.meta, {
      source: 'system',
      origin: 'system',
    });
    const prev = this.current;
    const fresh = createDocument({
      contents: contents.clone(),
      schema: this.current.schema,
      validate: options.validate ?? true,
      documentId: this.current.documentId,
    });
    const nextRevision = this.current.revision + 1;
    const next = new Document(
      fresh.contents,
      fresh.schema,
      nextRevision,
      meta,
      this.current.documentId,
      undefined,
    );
    const change = prev.contents.diff(next.contents);
    if (change.length() === 0) {
      return this.current;
    }
    this.mutating = true;
    try {
      const recorded = this.versions.recordApply(
        next.contents,
        next.revision,
        change,
        meta,
      );
      this.current = next;
      this.lastMeta = meta;
      if (recorded) {
        this.notifyObservers({
          type: 'applied',
          change: recorded.changeFromParent!,
          document: this.current,
          version: recorded,
          meta,
        });
      }
      return this.current;
    } finally {
      this.mutating = false;
    }
  }

  transaction(): DocumentTransaction {
    this.assertNotReentrant();
    if (this.openTx) {
      throw new DocumentError(
        'nested_transaction',
        'DocumentHandle.transaction: nested transactions are not supported',
      );
    }
    const tx = new DocumentTransaction(this.current, {
      onClose: () => {
        this.openTx = null;
      },
    });
    this.openTx = tx;
    return tx;
  }

  commitTransaction(
    build: (tx: DocumentTransaction) => void,
    options: TransactionCommitOptions = {},
  ): CommitTransactionResult {
    const tx = this.transaction();
    try {
      build(tx);
      const result = tx.commit(options);
      if (!result.empty) {
        this.apply(result.change, {
          meta: result.meta,
          validate: true,
        });
      }
      return {
        ...result,
        document: this.current,
        version: this.currentVersion(),
      };
    } catch (err) {
      if (tx.getStatus() === 'open') {
        tx.abort();
      }
      throw err;
    }
  }

  private applyInternal(
    change: ChangeSet,
    options: DocumentHandleApplyOptions,
    eventType: DocumentChangeEventType,
  ): Document {
    this.assertNotReentrant();
    if (this.openTx) {
      throw new DocumentError(
        'transaction_open',
        'DocumentHandle.apply: cannot apply while a transaction is open',
      );
    }
    if (change.length() === 0) {
      return this.current;
    }
    const meta = normalizeChangeMeta(options.meta, {
      source: options.meta?.source ?? 'api',
      origin: options.meta?.origin ?? 'system',
    });
    this.mutating = true;
    try {
      const next = this.current.apply(change, {
        validate: options.validate,
        meta,
      });
      const recorded = this.versions.recordApply(
        next.contents,
        next.revision,
        change,
        meta,
      );
      this.current = next;
      this.lastMeta = meta;
      if (recorded) {
        this.notifyObservers({
          type: eventType,
          change: recorded.changeFromParent!,
          document: this.current,
          version: recorded,
          meta,
        });
      }
      return this.current;
    } finally {
      this.mutating = false;
    }
  }

  private assertNotReentrant(): void {
    if (this.mutating || this.notifying) {
      throw new DocumentError(
        'reentrancy',
        'DocumentHandle: mutation from inside an observer (or nested mutation) is forbidden',
      );
    }
  }

  private notifyObservers(event: DocumentChangeEvent): void {
    if (this.listeners.length === 0) return;
    const snapshot = this.listeners.slice();
    this.notifying = true;
    let firstError: unknown;
    try {
      for (const listener of snapshot) {
        try {
          listener(event);
        } catch (err) {
          if (firstError === undefined) firstError = err;
        }
      }
    } finally {
      this.notifying = false;
    }
    if (firstError !== undefined) {
      throw new DocumentError(
        'observer_failed',
        `DocumentHandle observer failed: ${
          firstError instanceof Error ? firstError.message : String(firstError)
        }`,
        { cause: firstError },
      );
    }
  }
}
