import { applyFormat } from './matchers.js';
import {
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
import type { HtmlMatcher, HtmlSelector } from './types.js';

function alias(format: string): HtmlMatcher {
  return (_node, delta, host) => applyFormat(delta, format, true, host);
}

/** Default HTML matchers used by clipboard and HTML import. */
export const DEFAULT_HTML_MATCHERS: [HtmlSelector, HtmlMatcher][] = [
  [Node.TEXT_NODE, matchText],
  [Node.TEXT_NODE, matchNewline],
  ['br', matchBreak],
  [Node.ELEMENT_NODE, matchNewline],
  [Node.ELEMENT_NODE, matchBlot],
  [Node.ELEMENT_NODE, matchAttributor],
  [Node.ELEMENT_NODE, matchStyles],
  ['li', matchIndent],
  ['ol, ul', matchList],
  ['pre', matchCodeBlock],
  ['tr', matchTable],
  ['b', alias('bold')],
  ['i', alias('italic')],
  ['strike', alias('strike')],
  ['style', matchIgnore],
];
