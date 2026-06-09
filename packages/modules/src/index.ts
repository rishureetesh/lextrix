/** Lextrix modules — editor behavior modules. */
export {
  registerCoreModules,
  registerModules,
  registerOptionalModules,
} from './register.js';
export * from './register.js';
export {
  importHtml,
  DEFAULT_HTML_MATCHERS,
  type HtmlImportHost,
  type HtmlImportOptions,
  type HtmlMatcher,
} from './html-import/index.js';
