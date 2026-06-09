/** Shared headless HTML → ChangeSet importer. */
export { importHtml, prepareMatching } from './importer.js';
export { DEFAULT_HTML_MATCHERS } from './default-matchers.js';
export {
  applyFormat,
  deltaEndsWith,
  traverse,
  matchAttributor,
  matchBlot,
  matchBreak,
  matchCodeBlock,
  matchIgnore,
  matchIndent,
  matchList,
  matchNewline,
  matchStyles,
  matchTable,
  matchText,
} from './matchers.js';
export type {
  HtmlImportHost,
  HtmlImportOptions,
  HtmlMatcher,
  HtmlSelector,
} from './types.js';
