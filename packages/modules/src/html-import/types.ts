import type { ScrollBlot } from 'lextrix-dom';
import type ChangeSet from 'lextrix-change';

export type HtmlSelector = string | Node['TEXT_NODE'] | Node['ELEMENT_NODE'];

/** DOM → ChangeSet matcher invoked during HTML traversal. */
export type HtmlMatcher = (
  node: Node,
  delta: ChangeSet,
  host: HtmlImportHost,
) => ChangeSet;

/** Minimal host contract for HTML import (implemented by Scroll). */
export type HtmlImportHost = Pick<ScrollBlot, 'query'>;

export interface HtmlImportOptions {
  /** Additional matchers appended after defaults. */
  matchers?: [HtmlSelector, HtmlMatcher][];
  /** Normalize external HTML (Word, Google Docs, etc.) before traversal. */
  normalizeDocument?: (doc: Document) => void;
  /** Strip trailing document newline (clipboard paste behaviour). */
  stripTrailingNewline?: boolean;
}
