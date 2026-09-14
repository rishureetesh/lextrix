/**
 * DocumentHandle observation events (ADR-017).
 */
import type ChangeSet from '../change/change-set.js';
import type { ChangeMeta } from './change-meta.js';
import type { Document } from './document.js';
import type { DocumentVersion } from './version.js';

export type DocumentChangeEventType = 'applied' | 'restored';

/**
 * Immutable notification of a committed Handle transition.
 * Emitted only for non-empty Version-creating mutations.
 */
export interface DocumentChangeEvent {
  readonly type: DocumentChangeEventType;
  /** Transition ChangeSet (same as Version.changeFromParent). */
  readonly change: ChangeSet;
  /** New HEAD Document value. */
  readonly document: Document;
  /** New HEAD Version. */
  readonly version: DocumentVersion;
  readonly meta: ChangeMeta | null;
}

export type DocumentChangeListener = (event: DocumentChangeEvent) => void;
