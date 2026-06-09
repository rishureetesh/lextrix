/** Lextrix content serialization layer. */
export type {
  BuiltinSerializeFormat,
  SerializeFormat,
  ExportOptions,
  SerializerAdapter,
  SerializerContext,
  ContentSerializer,
  SerializerFactory,
  ComponentSerializerExtension,
} from './types.js';

export {
  SerializerRegistry,
  registerSerializer,
  unregisterSerializer,
  getGlobalSerializerRegistry,
  createSerializerRegistry,
} from './registry.js';

export { SerializerHost, type ExportInput } from './host.js';

export {
  splitChangeSetIntoBlocks,
  blocksToChangeSet,
  type DocumentBlock,
} from './change-set-blocks.js';

export {
  normalizeChangeSet,
  changeSetsEquivalent,
  type EquivalenceOptions,
} from './equivalence.js';

export { createDefaultSerializers } from './defaults.js';

export {
  SerializationError,
  validateMarkdownExport,
  findNativeTableCells,
  findLossyMarkdownIssues,
  findBlockedMarkdownExportIssues,
  getMarkdownExportWarnings,
  type ConversionSafety,
  type SafetyIssue,
} from './safety.js';

export { jsonSerializer, createJsonSerializer } from './json/json-serializer.js';
export {
  htmlSerializer,
  createHtmlSerializer,
  type HtmlSerializerOptions,
} from './html/html-serializer.js';
export {
  markdownSerializer,
  createMarkdownSerializer,
} from './markdown/markdown-serializer.js';
export {
  mdxSerializer,
  createMdxSerializer,
  type MdxSerializerOptions,
} from './mdx/mdx-serializer.js';

export {
  MdxComponentRegistry,
  getGlobalMdxComponentRegistry,
  registerMdxComponent,
  type MdxComponentNode,
  type MdxComponentHandler,
} from './mdx/component-registry.js';

export { parseMarkdownBlocks, markdownBlocksToChangeSet } from './markdown/parse.js';
export { changeSetToMarkdown } from './markdown/emit.js';
export { mdxToChangeSet, splitMdxSegments, parseMdxComponent } from './mdx/parse.js';
export { changeSetToMdx } from './mdx/emit.js';
