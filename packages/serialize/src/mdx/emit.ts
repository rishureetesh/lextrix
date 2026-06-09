import ChangeSet from 'lextrix-change';
import {
  blocksToChangeSet,
  splitChangeSetIntoBlocks,
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

  blocks.forEach((block) => {
    const componentTag = block.attributes['mdx-component'];
    if (componentTag) {
      const tag = String(componentTag);
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
        parts.push(custom);
        return;
      }

      const raw = block.content
        .filter((op) => typeof op.insert === 'string')
        .map((op) => op.insert)
        .join('');
      parts.push(raw);
      return;
    }

    const md = changeSetToMarkdown(blocksToChangeSet([block]));
    if (md.trim().length > 0) {
      parts.push(md);
    }
  });

  return parts.join('\n\n');
}
