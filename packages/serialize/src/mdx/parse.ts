import ChangeSet, { type ChangeOp } from 'lextrix-change';
import type { DocumentBlock } from '../change-set-blocks.js';
import { blocksToChangeSet, splitChangeSetIntoBlocks } from '../change-set-blocks.js';
import {
  markdownBlocksToChangeSet,
  parseMarkdownBlocks,
} from '../markdown/parse.js';
import type { SerializerContext } from '../types.js';
import {
  getGlobalMdxComponentRegistry,
  type MdxComponentNode,
  type MdxComponentRegistry,
} from './component-registry.js';

const MDX_COMPONENT_PATTERN =
  /<([A-Z][A-Za-z0-9]*)([^>/]*)(\/>|>([\s\S]*?)<\/\1>)/g;

const MDX_IMPORT_PATTERN = /^import\s+.+from\s+['"][^'"]+['"];?\s*$/gm;
const MDX_EXPORT_PATTERN = /^export\s+.+$/gm;

/** Strips MDX frontmatter and import/export statements. */
export function stripMdxPreamble(source: string): string {
  let body = source;
  const frontmatter = body.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (frontmatter) {
    body = body.slice(frontmatter[0].length);
  }
  return body.replace(MDX_IMPORT_PATTERN, '').replace(MDX_EXPORT_PATTERN, '');
}

/** Parses an MDX component from raw JSX text. */
export function parseMdxComponent(raw: string): MdxComponentNode | null {
  const trimmed = raw.trim();
  const match = trimmed.match(
    /^<([A-Z][A-Za-z0-9]*)([^>/]*)(\/>|>([\s\S]*?)<\/\1>)\s*$/,
  );
  if (!match) return null;

  const selfClosing = match[3] === '/>';
  return {
    tag: match[1],
    props: parseProps(match[2].trim()),
    children: selfClosing ? '' : (match[4] ?? '').trim(),
    selfClosing,
    raw: trimmed,
  };
}

function parseProps(propsRaw: string): Record<string, string> {
  const props: Record<string, string> = {};
  const propPattern = /([A-Za-z_][\w-]*)(?:=(?:"([^"]*)"|'([^']*)'|(\{[^}]+\})))?/g;
  let match: RegExpExecArray | null;
  while ((match = propPattern.exec(propsRaw)) !== null) {
    props[match[1]] = match[2] ?? match[3] ?? match[4] ?? 'true';
  }
  return props;
}

interface MdxSegment {
  type: 'markdown' | 'component';
  text: string;
  component?: MdxComponentNode;
}

/** Splits MDX source into alternating markdown and component segments. */
export function splitMdxSegments(source: string): MdxSegment[] {
  const segments: MdxSegment[] = [];
  let lastIndex = 0;

  const body = stripMdxPreamble(source);
  MDX_COMPONENT_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MDX_COMPONENT_PATTERN.exec(body)) !== null) {
    const before = body.slice(lastIndex, match.index).trim();
    if (before.length > 0) {
      segments.push({ type: 'markdown', text: before });
    }

    const component = parseMdxComponent(match[0]);
    if (component) {
      segments.push({ type: 'component', text: match[0], component });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = body.slice(lastIndex).trim();
  if (remaining.length > 0) {
    segments.push({ type: 'markdown', text: remaining });
  }

  return segments;
}

function changeSetToDocumentBlock(delta: ChangeSet): DocumentBlock {
  const content: ChangeOp[] = [];
  let attributes: Record<string, unknown> = {};

  delta.forEach((op) => {
    if (op.insert === '\n') {
      attributes = { ...attributes, ...(op.attributes ?? {}) };
    } else if (op.insert != null) {
      content.push(op);
    }
  });

  return { content, attributes };
}

function componentToDocumentBlock(
  node: MdxComponentNode,
  registry: MdxComponentRegistry,
  context?: SerializerContext,
): DocumentBlock {
  const handler = registry.get(node.tag);
  const custom = handler?.toChangeSet?.(node, context);
  if (custom) {
    return changeSetToDocumentBlock(custom);
  }

  return {
    content: [{ insert: node.raw }],
    attributes: { 'mdx-component': node.tag },
  };
}

/** Converts MDX source to a ChangeSet via the shared markdown pipeline. */
export function mdxToChangeSet(
  source: string,
  context?: SerializerContext,
  registry: MdxComponentRegistry = getGlobalMdxComponentRegistry(),
): ChangeSet {
  const segments = splitMdxSegments(source);
  const documentBlocks: DocumentBlock[] = [];

  segments.forEach((segment) => {
    if (segment.type === 'component' && segment.component) {
      documentBlocks.push(
        componentToDocumentBlock(segment.component, registry, context),
      );
      return;
    }

    documentBlocks.push(
      ...markdownSegmentToDocumentBlocks(segment.text),
    );
  });

  if (documentBlocks.length === 0) {
    return new ChangeSet();
  }

  return blocksToChangeSet(documentBlocks);
}

function markdownSegmentToDocumentBlocks(text: string): DocumentBlock[] {
  const mdBlocks = parseMarkdownBlocks(text);
  if (mdBlocks.length === 0) return [];
  return splitChangeSetIntoBlocks(markdownBlocksToChangeSet(mdBlocks));
}
