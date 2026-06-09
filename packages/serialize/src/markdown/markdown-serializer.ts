import type { ContentSerializer, SerializerFactory } from '../types.js';
import { validateMarkdownExport } from '../safety.js';
import { markdownBlocksToChangeSet, parseMarkdownBlocks } from './parse.js';
import { changeSetToMarkdown } from './emit.js';

/** Markdown serializer — ChangeSet ↔ CommonMark/GFM subset. */
export function markdownSerializer(): ContentSerializer {
  return {
    format: 'markdown',

    import(content: string) {
      const blocks = parseMarkdownBlocks(content);
      return markdownBlocksToChangeSet(blocks);
    },

    export(changeSet) {
      validateMarkdownExport(changeSet);
      return changeSetToMarkdown(changeSet);
    },
  };
}

export const createMarkdownSerializer: SerializerFactory = markdownSerializer;
