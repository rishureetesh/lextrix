/**
 * Experimental headless DocumentState (Phase 1–3).
 *
 * NOT a stable public API — import from `lextrix-change/experimental`.
 * Must not import DOM, window, Scroll, Blot, or Editor.
 *
 * Law: DocumentState --apply(ChangeSet)--> DocumentState'
 * Version identifies DocumentState; ChangeSet is the transition.
 */
import ChangeSet from '../change/change-set.js';
import {
  normalizeChangeMeta,
  type ChangeMeta,
} from './change-meta.js';
import {
  DEFAULT_DOCUMENT_SCHEMA,
  type DocumentSchema,
  type SchemaValidationResult,
} from './schema.js';
import { DocumentTransaction } from './transaction.js';
import { createDocumentId, createVersionId } from './version.js';

export interface CreateDocumentOptions {
  /** Insert-only document ChangeSet (or ops array). */
  contents?: ChangeSet | ConstructorParameters<typeof ChangeSet>[0];
  schema?: DocumentSchema;
  /** Validate on create/apply (default true). */
  validate?: boolean;
  /** Initial revision (default 0). */
  revision?: number;
  /** Stable document identity (default generated). */
  documentId?: string;
}

export interface DocumentApplyOptions {
  validate?: boolean;
  /** Optional metadata recorded on the resulting Document (not part of contents). */
  meta?: Partial<ChangeMeta>;
}

/**
 * Immutable DocumentState boundary: contents + schema + revision + version id.
 * Transitions happen only via {@link Document.apply}.
 * Retained version history lives on {@link DocumentHandle}, not here.
 */
export class Document {
  readonly contents: ChangeSet;
  readonly schema: DocumentSchema;
  /**
   * Mutation counter / sync metadata (Phase 2).
   * Advances on non-empty apply. Distinct from Version identity (ADR-004).
   */
  readonly revision: number;
  /** Metadata from the last apply that produced this instance (if any). */
  readonly lastAppliedMeta: ChangeMeta | null;
  /** Identity of the document lineage this state belongs to. */
  readonly documentId: string;
  /** Version id for this immutable state snapshot. */
  readonly versionId: string;

  constructor(
    contents: ChangeSet,
    schema: DocumentSchema,
    revision = 0,
    lastAppliedMeta: ChangeMeta | null = null,
    documentId?: string,
    versionId?: string,
  ) {
    this.contents = contents;
    this.schema = schema;
    this.revision = revision;
    this.lastAppliedMeta = lastAppliedMeta;
    this.documentId = documentId ?? createDocumentId();
    this.versionId =
      versionId ?? createVersionId(this.documentId, revision);
  }

  getContents(): ChangeSet {
    return this.contents;
  }

  /**
   * Apply a ChangeSet transition.
   * Semantics: `nextContents = this.contents.compose(change)` (Quill document compose).
   * Returns a new Document; does not mutate this instance.
   * Empty change → same instance (no revision/version advance).
   */
  apply(change: ChangeSet, options: DocumentApplyOptions = {}): Document {
    const validate = options.validate ?? true;
    if (change.length() === 0) {
      return this;
    }
    const nextContents = this.contents.compose(change);
    if (validate) {
      const result = this.schema.validate(nextContents);
      if (!result.ok) {
        throw new Error(
          `Document.apply produced invalid document: ${result.issues.join('; ')}`,
        );
      }
    }
    const frozen = nextContents.clone().freeze();
    const meta = options.meta
      ? normalizeChangeMeta(options.meta, {
          source: options.meta.source ?? 'api',
          origin: options.meta.origin ?? 'system',
        })
      : null;
    const nextRevision = this.revision + 1;
    return new Document(
      frozen,
      this.schema,
      nextRevision,
      meta,
      this.documentId,
      createVersionId(this.documentId, nextRevision),
    );
  }

  /**
   * Start a transaction against this snapshot.
   * Commit returns a ChangeSet; caller must {@link apply} (or use DocumentHandle).
   */
  transaction(): DocumentTransaction {
    return new DocumentTransaction(this);
  }

  /**
   * Internal/helper: same contents/schema with an explicit revision/versionId
   * (used by DocumentHandle recovery).
   */
  withRevision(revision: number): Document {
    return new Document(
      this.contents,
      this.schema,
      revision,
      this.lastAppliedMeta,
      this.documentId,
      createVersionId(this.documentId, revision),
    );
  }

  validate(): SchemaValidationResult {
    return this.schema.validate(this.contents);
  }

  /** JSON-serializable ops snapshot. */
  toJSON(): {
    ops: ChangeSet['ops'];
    schema: string;
    revision: number;
    documentId: string;
    versionId: string;
  } {
    return {
      ops: this.contents.ops,
      schema: this.schema.name,
      revision: this.revision,
      documentId: this.documentId,
      versionId: this.versionId,
    };
  }
}

export function createDocument(options: CreateDocumentOptions = {}): Document {
  const schema = options.schema ?? DEFAULT_DOCUMENT_SCHEMA;
  const validate = options.validate ?? true;
  const raw =
    options.contents instanceof ChangeSet
      ? options.contents.clone()
      : new ChangeSet(options.contents);

  // Empty document is a single newline (Quill convention)
  if (raw.ops.length === 0) {
    raw.insert('\n');
  }

  const contents = raw.freeze();
  if (validate) {
    const result = schema.validate(contents);
    if (!result.ok) {
      throw new Error(
        `Invalid document contents: ${result.issues.join('; ')}`,
      );
    }
  }
  const documentId = options.documentId ?? createDocumentId();
  const revision = options.revision ?? 0;
  return new Document(
    contents,
    schema,
    revision,
    null,
    documentId,
    createVersionId(documentId, revision),
  );
}
