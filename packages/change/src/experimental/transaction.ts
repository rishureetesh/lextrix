/**
 * Experimental DocumentTransaction — accumulates ops; commit → ChangeSet.
 * Does not touch DOM / Scroll / Blot / Editor.
 */
import ChangeSet from '../change/change-set.js';
import type ChangeAttributes from '../change/change-attributes.js';
import {
  normalizeChangeMeta,
  type ChangeMeta,
  type ChangeSource,
} from './change-meta.js';
import type { Document } from './document.js';

export type TransactionStatus = 'open' | 'committed' | 'aborted';

export interface TransactionCommitOptions {
  source?: ChangeSource;
  authorId?: string;
  intent?: string;
  /** Extra metadata fields. */
  [key: string]: unknown;
}

export interface TransactionCommitResult {
  /** Logical ChangeSet for this commit (may be empty). */
  change: ChangeSet;
  meta: ChangeMeta;
  /** Document.revision at transaction begin. */
  baseRevision: number;
  /** True when change.length() === 0. */
  empty: boolean;
}

export class DocumentTransaction {
  readonly base: Document;
  readonly baseRevision: number;
  private status: TransactionStatus = 'open';
  private pending: ChangeSet = new ChangeSet();
  private readonly onClose?: (tx: DocumentTransaction) => void;

  constructor(
    base: Document,
    options: { onClose?: (tx: DocumentTransaction) => void } = {},
  ) {
    this.base = base;
    this.baseRevision = base.revision;
    this.onClose = options.onClose;
  }

  getStatus(): TransactionStatus {
    return this.status;
  }

  /** Working document contents after pending ops (against base). */
  getWorkingContents(): ChangeSet {
    this.assertOpen();
    if (this.pending.ops.length === 0) {
      return this.base.getContents();
    }
    return this.base.getContents().compose(this.pending);
  }

  /**
   * Insert text or embed at index in the **current working** document.
   */
  insert(
    index: number,
    value: string | Record<string, unknown>,
    attributes?: ChangeAttributes | Record<string, unknown> | null,
  ): this {
    this.assertOpen();
    this.assertIndex(index);
    const step = new ChangeSet().retain(index).insert(value, attributes ?? undefined);
    this.pending = this.pending.compose(step);
    return this;
  }

  /** Delete `length` characters at index in the working document. */
  delete(index: number, length: number): this {
    this.assertOpen();
    if (length < 0) {
      throw new Error('DocumentTransaction.delete: length must be >= 0');
    }
    if (length === 0) return this;
    this.assertIndex(index);
    const workingLen = this.getWorkingContents().length();
    if (index + length > workingLen) {
      throw new Error(
        `DocumentTransaction.delete: range ${index}+${length} exceeds length ${workingLen}`,
      );
    }
    const step = new ChangeSet().retain(index).delete(length);
    this.pending = this.pending.compose(step);
    return this;
  }

  /** Format a range in the working document. */
  format(
    index: number,
    length: number,
    attributes: ChangeAttributes | Record<string, unknown>,
  ): this {
    this.assertOpen();
    if (length < 0) {
      throw new Error('DocumentTransaction.format: length must be >= 0');
    }
    if (length === 0) return this;
    this.assertIndex(index);
    const step = new ChangeSet().retain(index).retain(length, attributes);
    this.pending = this.pending.compose(step);
    return this;
  }

  /**
   * Compose an arbitrary ChangeSet against the working document
   * (indices relative to working state).
   */
  update(change: ChangeSet): this {
    this.assertOpen();
    this.pending = this.pending.compose(change);
    return this;
  }

  /**
   * Commit: return one logical ChangeSet. Does **not** call Document.apply.
   * Empty transactions return an empty ChangeSet (never null).
   */
  commit(options: TransactionCommitOptions = {}): TransactionCommitResult {
    this.assertOpen();
    this.status = 'committed';
    this.onClose?.(this);
    const change = this.pending.clone().freeze();
    const meta = normalizeChangeMeta(options as Partial<ChangeMeta>, {
      source: options.source ?? 'api',
      origin: 'transaction',
    });
    return {
      change,
      meta,
      baseRevision: this.baseRevision,
      empty: change.length() === 0,
    };
  }

  /** Abort: no document mutation; further use throws. */
  abort(): void {
    if (this.status === 'committed') {
      throw new Error('DocumentTransaction.abort: already committed');
    }
    if (this.status === 'aborted') {
      return;
    }
    this.status = 'aborted';
    this.pending = new ChangeSet();
    this.onClose?.(this);
  }

  private assertOpen(): void {
    if (this.status === 'committed') {
      throw new Error('DocumentTransaction: already committed');
    }
    if (this.status === 'aborted') {
      throw new Error('DocumentTransaction: aborted');
    }
  }

  private assertIndex(index: number): void {
    if (!Number.isFinite(index) || index < 0) {
      throw new Error(`DocumentTransaction: invalid index ${index}`);
    }
    const len = this.getWorkingContents().length();
    if (index > len) {
      throw new Error(
        `DocumentTransaction: index ${index} exceeds length ${len}`,
      );
    }
  }
}
