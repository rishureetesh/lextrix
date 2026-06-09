import {
  Attributor,
  BlockBlot,
  ClassAttributor,
  EmbedBlot,
  Scope,
  StyleAttributor,
} from 'lextrix-dom';
import { BlockEmbed } from 'lextrix-core/blots/block.js';
import ChangeSet from 'lextrix-change';
import { AlignAttribute, AlignStyle } from 'lextrix-formats/formats/align.js';
import { BackgroundStyle } from 'lextrix-formats/formats/background.js';
import { ColorStyle } from 'lextrix-formats/formats/color.js';
import { DirectionAttribute, DirectionStyle } from 'lextrix-formats/formats/direction.js';
import { FontStyle } from 'lextrix-formats/formats/font.js';
import { SizeStyle } from 'lextrix-formats/formats/size.js';
import type { HtmlImportHost, HtmlMatcher } from './types.js';

const ATTRIBUTE_ATTRIBUTORS = [AlignAttribute, DirectionAttribute].reduce(
  (memo: Record<string, Attributor>, attr) => {
    memo[attr.keyName] = attr;
    return memo;
  },
  {},
);

const STYLE_ATTRIBUTORS = [
  AlignStyle,
  BackgroundStyle,
  ColorStyle,
  DirectionStyle,
  FontStyle,
  SizeStyle,
].reduce((memo: Record<string, Attributor>, attr) => {
  memo[attr.keyName] = attr;
  return memo;
}, {});

export function applyFormat(
  delta: ChangeSet,
  format: string,
  value: unknown,
  host: HtmlImportHost,
): ChangeSet {
  if (!host.query(format)) {
    return delta;
  }

  return delta.reduce((newChangeSet, op) => {
    if (!op.insert) return newChangeSet;
    if (op.attributes && op.attributes[format]) {
      return newChangeSet.push(op);
    }
    const formats = value ? { [format]: value } : {};
    return newChangeSet.insert(op.insert, { ...formats, ...op.attributes });
  }, new ChangeSet());
}

export function deltaEndsWith(delta: ChangeSet, text: string) {
  let endText = '';
  for (
    let i = delta.ops.length - 1;
    i >= 0 && endText.length < text.length;
    --i // eslint-disable-line no-plusplus
  ) {
    const op = delta.ops[i];
    if (typeof op.insert !== 'string') break;
    endText = op.insert + endText;
  }
  return endText.slice(-1 * text.length) === text;
}

function isLine(node: Node, host: HtmlImportHost) {
  if (!(node instanceof Element)) return false;
  const match = host.query(node);
  // @ts-expect-error
  if (match && match.prototype instanceof EmbedBlot) return false;

  return [
    'address', 'article', 'blockquote', 'canvas', 'dd', 'div', 'dl', 'dt',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'header', 'iframe', 'li', 'main', 'nav', 'ol', 'output',
    'p', 'pre', 'section', 'table', 'td', 'tr', 'ul', 'video',
  ].includes(node.tagName.toLowerCase());
}

function isBetweenInlineElements(node: HTMLElement, host: HtmlImportHost) {
  return (
    node.previousElementSibling &&
    node.nextElementSibling &&
    !isLine(node.previousElementSibling, host) &&
    !isLine(node.nextElementSibling, host)
  );
}

function isTextBetweenInlineElements(node: Text, host: HtmlImportHost) {
  const prev = node.previousSibling;
  const next = node.nextSibling;
  return (
    prev instanceof Element &&
    next instanceof Element &&
    !isLine(prev, host) &&
    !isLine(next, host)
  );
}

const preNodes = new WeakMap<Node, boolean>();
function isPre(node: Node | null) {
  if (node == null) return false;
  if (!preNodes.has(node)) {
    if (node instanceof Element && node.tagName === 'PRE') {
      preNodes.set(node, true);
    } else {
      preNodes.set(node, isPre(node.parentNode));
    }
  }
  return preNodes.get(node) ?? false;
}

export function traverse(
  host: HtmlImportHost,
  node: ChildNode,
  elementMatchers: HtmlMatcher[],
  textMatchers: HtmlMatcher[],
  nodeMatches: WeakMap<Node, HtmlMatcher[]>,
): ChangeSet {
  if (node.nodeType === node.TEXT_NODE) {
    return textMatchers.reduce((delta: ChangeSet, matcher) => {
      return matcher(node, delta, host);
    }, new ChangeSet());
  }
  if (node.nodeType === node.ELEMENT_NODE) {
    return Array.from(node.childNodes || []).reduce((delta, childNode) => {
      let childrenChangeSet = traverse(
        host,
        childNode,
        elementMatchers,
        textMatchers,
        nodeMatches,
      );
      if (childNode.nodeType === node.ELEMENT_NODE) {
        childrenChangeSet = elementMatchers.reduce((reducedChangeSet, matcher) => {
          return matcher(childNode as HTMLElement, reducedChangeSet, host);
        }, childrenChangeSet);
        childrenChangeSet = (nodeMatches.get(childNode) || []).reduce(
          (reducedChangeSet, matcher) => {
            return matcher(childNode, reducedChangeSet, host);
          },
          childrenChangeSet,
        );
      }
      return delta.concat(childrenChangeSet);
    }, new ChangeSet());
  }
  return new ChangeSet();
}

export const matchAttributor: HtmlMatcher = (node, delta, host) => {
  if (!(node instanceof HTMLElement)) return delta;
  const attributes = Attributor.keys(node);
  const classes = ClassAttributor.keys(node);
  const styles = StyleAttributor.keys(node);
  const formats: Record<string, string | undefined> = {};
  attributes
    .concat(classes)
    .concat(styles)
    .forEach((name) => {
      let attr = host.query(name, Scope.ATTRIBUTE) as Attributor;
      if (attr != null) {
        formats[attr.attrName] = attr.value(node);
        if (formats[attr.attrName]) return;
      }
      attr = ATTRIBUTE_ATTRIBUTORS[name];
      if (attr != null && (attr.attrName === name || attr.keyName === name)) {
        formats[attr.attrName] = attr.value(node) || undefined;
      }
      attr = STYLE_ATTRIBUTORS[name];
      if (attr != null && (attr.attrName === name || attr.keyName === name)) {
        formats[attr.attrName] = attr.value(node) || undefined;
      }
    });

  return Object.entries(formats).reduce(
    (newChangeSet, [name, value]) => applyFormat(newChangeSet, name, value, host),
    delta,
  );
};

export const matchBlot: HtmlMatcher = (node, delta, host) => {
  const match = host.query(node);
  if (match == null) return delta;
  // @ts-expect-error
  if (match.prototype instanceof EmbedBlot) {
    const embed: Record<string, unknown> = {};
    // @ts-expect-error
    const value = match.value(node);
    if (value != null) {
      // @ts-expect-error
      embed[match.blotName] = value;
      // @ts-expect-error
      return new ChangeSet().insert(embed, match.formats(node, host));
    }
  } else {
    // @ts-expect-error
    if (match.prototype instanceof BlockBlot && !deltaEndsWith(delta, '\n')) {
      delta.insert('\n');
    }
    if (
      'blotName' in match &&
      'formats' in match &&
      typeof match.formats === 'function'
    ) {
      return applyFormat(
        delta,
        match.blotName,
        match.formats(node, host),
        host,
      );
    }
  }
  return delta;
};

export const matchBreak: HtmlMatcher = (_node, delta) => {
  if (!deltaEndsWith(delta, '\n')) {
    delta.insert('\n');
  }
  return delta;
};

export const matchCodeBlock: HtmlMatcher = (node, delta, host) => {
  const match = host.query('code-block');
  const language =
    match && 'formats' in match && typeof match.formats === 'function'
      ? match.formats(node, host)
      : true;
  return applyFormat(delta, 'code-block', language, host);
};

export const matchIgnore: HtmlMatcher = () => new ChangeSet();

export const matchIndent: HtmlMatcher = (node, delta, host) => {
  const match = host.query(node);
  if (
    match == null ||
    // @ts-expect-error
    match.blotName !== 'list' ||
    !deltaEndsWith(delta, '\n')
  ) {
    return delta;
  }
  let indent = -1;
  let parent = node.parentNode;
  while (parent != null) {
    if (parent instanceof Element && ['OL', 'UL'].includes(parent.tagName)) {
      indent += 1;
    }
    parent = parent.parentNode;
  }
  if (indent <= 0) return delta;
  return delta.reduce((composed, op) => {
    if (!op.insert) return composed;
    if (op.attributes && typeof op.attributes.indent === 'number') {
      return composed.push(op);
    }
    return composed.insert(op.insert, { indent, ...(op.attributes || {}) });
  }, new ChangeSet());
};

export const matchList: HtmlMatcher = (node, delta, host) => {
  if (!(node instanceof Element)) return delta;
  let list = node.tagName === 'OL' ? 'ordered' : 'bullet';
  const checkedAttr = node.getAttribute('data-checked');
  if (checkedAttr) {
    list = checkedAttr === 'true' ? 'checked' : 'unchecked';
  }
  return applyFormat(delta, 'list', list, host);
};

export const matchNewline: HtmlMatcher = (node, delta, host) => {
  if (!deltaEndsWith(delta, '\n')) {
    if (
      isLine(node, host) &&
      (node instanceof Element &&
        (node.childNodes.length > 0 || node instanceof HTMLParagraphElement)) &&
      !deltaEndsWith(delta, '\n')
    ) {
      return delta.insert('\n');
    }
    if (delta.length() > 0 && node.nextSibling) {
      let nextSibling: Node | null = node.nextSibling;
      while (nextSibling != null) {
        if (isLine(nextSibling, host)) {
          return delta.insert('\n');
        }
        const match = host.query(nextSibling);
        // @ts-expect-error
        if (match && match.prototype instanceof EmbedBlot) {
          // @ts-expect-error
          if (match.blotName === 'break') {
            return delta;
          }
          // @ts-expect-error
          if (match.prototype instanceof BlockEmbed) {
            return delta.insert('\n');
          }
          if (
            node.parentElement &&
            nextSibling.parentElement &&
            node.parentElement === nextSibling.parentElement
          ) {
            return delta;
          }
          return delta.insert('\n');
        }
        nextSibling = nextSibling.firstChild;
      }
    }
  }
  return delta;
};

export const matchStyles: HtmlMatcher = (node, delta, host) => {
  if (!(node instanceof HTMLElement)) return delta;
  const formats: Record<string, unknown> = {};
  const style: Partial<CSSStyleDeclaration> = node.style || {};
  if (style.fontStyle === 'italic') formats.italic = true;
  if (style.textDecoration === 'underline') formats.underline = true;
  if (style.textDecoration === 'line-through') formats.strike = true;
  if (
    style.fontWeight?.startsWith('bold') ||
    parseInt(style.fontWeight ?? '', 10) >= 700
  ) {
    formats.bold = true;
  }
  let result = Object.entries(formats).reduce(
    (newChangeSet, [name, value]) => applyFormat(newChangeSet, name, value, host),
    delta,
  );
  if (parseFloat(style.textIndent || '0') > 0) {
    result = new ChangeSet().insert('\t').concat(result);
  }
  return result;
};

export const matchTable: HtmlMatcher = (node, delta, host) => {
  if (!(node instanceof HTMLTableRowElement)) return delta;
  const table =
    node.parentElement?.tagName === 'TABLE'
      ? node.parentElement
      : node.parentElement?.parentElement;
  if (table != null) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const row = rows.indexOf(node) + 1;
    return applyFormat(delta, 'table', row, host);
  }
  return delta;
};

export const matchText: HtmlMatcher = (node, delta, host) => {
  if (node.nodeType !== Node.TEXT_NODE) return delta;
  const textNode = node as Text;
  let text = textNode.data;
  if (node.parentElement?.tagName === 'O:P') {
    return delta.insert(text.trim());
  }
  if (!isPre(node)) {
    if (text.trim().length === 0 && text.includes('\n')) {
      if (isTextBetweenInlineElements(textNode, host)) {
        return delta.insert(' ');
      }
      if (
        node.parentElement &&
        !isBetweenInlineElements(node.parentElement, host)
      ) {
        return delta;
      }
    }
    text = text.replace(/[^\S\u00a0]/g, ' ');
    text = text.replace(/ {2,}/g, ' ');
    if (
      (node.previousSibling == null &&
        node.parentElement != null &&
        isLine(node.parentElement, host)) ||
      (node.previousSibling instanceof Element &&
        isLine(node.previousSibling, host))
    ) {
      text = text.replace(/^ /, '');
    }
    if (
      (node.nextSibling == null &&
        node.parentElement != null &&
        isLine(node.parentElement, host)) ||
      (node.nextSibling instanceof Element && isLine(node.nextSibling, host))
    ) {
      text = text.replace(/ $/, '');
    }
    text = text.replaceAll('\u00a0', ' ');
  }
  return delta.insert(text);
};
