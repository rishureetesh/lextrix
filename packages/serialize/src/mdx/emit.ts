import ChangeSet from 'lextrix-change';
import {
  blocksToChangeSet,
  splitChangeSetIntoBlocks,
  type DocumentBlock,
} from '../change-set-blocks.js';
import { changeSetToMarkdown } from '../markdown/emit.js';
import type { SerializerContext } from '../types.js';
import {
  getGlobalMdxComponentRegistry,
  type MdxComponentRegistry,
} from './component-registry.js';

/** Converts a ChangeSet to MDX source. */
export function changeSetToMdx(
  delta: ChangeSet,
  context?: SerializerContext,
  registry: MdxComponentRegistry = getGlobalMdxComponentRegistry(),
): string {
  const blocks = splitChangeSetIntoBlocks(delta);
  const parts: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.attributes['mdx-component']) {
      parts.push(emitMdxComponentBlock(block, context, registry));
      i += 1;
      continue;
    }

    const run: DocumentBlock[] = [];
    while (i < blocks.length && !blocks[i].attributes['mdx-component']) {
      run.push(blocks[i]);
      i += 1;
    }

    const md = changeSetToMarkdown(blocksToChangeSet(run));
    if (md.trim().length > 0) {
      parts.push(md);
    }
  }

  return parts.join('\n\n');
}

function emitMdxComponentBlock(
  block: DocumentBlock,
  context: SerializerContext | undefined,
  registry: MdxComponentRegistry,
): string {
  const tag = String(block.attributes['mdx-component']);
  const handler = registry.get(tag);
  const custom = handler?.fromChangeSet?.(
    {
      tag,
      content: block.content,
      attributes: block.attributes,
    },
    context,
  );
  if (custom) {
    return custom;
  }

  return block.content
    .filter((op) => typeof op.insert === 'string')
    .map((op) => op.insert)
    .join('');
}
