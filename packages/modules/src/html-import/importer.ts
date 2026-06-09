import ChangeSet from 'lextrix-change';
import { DEFAULT_HTML_MATCHERS } from './default-matchers.js';
import { deltaEndsWith, traverse } from './matchers.js';
import type { HtmlImportHost, HtmlImportOptions, HtmlMatcher, HtmlSelector } from './types.js';

export function prepareMatching(
  container: Element,
  matchers: [HtmlSelector, HtmlMatcher][],
  nodeMatches: WeakMap<Node, HtmlMatcher[]>,
): [HtmlMatcher[], HtmlMatcher[]] {
  const elementMatchers: HtmlMatcher[] = [];
  const textMatchers: HtmlMatcher[] = [];
  matchers.forEach(([selector, matcher]) => {
    switch (selector) {
      case Node.TEXT_NODE:
        textMatchers.push(matcher);
        break;
      case Node.ELEMENT_NODE:
        elementMatchers.push(matcher);
        break;
      default:
        Array.from(container.querySelectorAll(selector)).forEach((node) => {
          if (nodeMatches.has(node)) {
            nodeMatches.get(node)?.push(matcher);
          } else {
            nodeMatches.set(node, [matcher]);
          }
        });
        break;
    }
  });
  return [elementMatchers, textMatchers];
}

/**
 * Headless HTML → ChangeSet importer.
 * Single source of truth for clipboard paste and editor.import('html').
 */
export function importHtml(
  html: string,
  host: HtmlImportHost,
  options: HtmlImportOptions = {},
): ChangeSet {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  options.normalizeDocument?.(doc);

  const matchers = [
    ...DEFAULT_HTML_MATCHERS,
    ...(options.matchers ?? []),
  ];

  const container = doc.body;
  const nodeMatches = new WeakMap<Node, HtmlMatcher[]>();
  const [elementMatchers, textMatchers] = prepareMatching(
    container,
    matchers,
    nodeMatches,
  );

  let delta = traverse(host, container, elementMatchers, textMatchers, nodeMatches);

  if (
    options.stripTrailingNewline !== false &&
    deltaEndsWith(delta, '\n') &&
    delta.ops[delta.ops.length - 1]?.attributes == null
  ) {
    delta = delta.compose(new ChangeSet().retain(delta.length() - 1).delete(1));
  }

  return delta;
}
