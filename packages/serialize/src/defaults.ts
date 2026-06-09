import type { ContentSerializer } from './types.js';
import { htmlSerializer } from './html/html-serializer.js';
import { jsonSerializer } from './json/json-serializer.js';
import { markdownSerializer } from './markdown/markdown-serializer.js';
import { mdxSerializer } from './mdx/mdx-serializer.js';

/** Built-in serializers shipped with Lextrix. */
export function createDefaultSerializers(): ContentSerializer[] {
  return [
    jsonSerializer(),
    htmlSerializer(),
    markdownSerializer(),
    mdxSerializer(),
  ];
}
