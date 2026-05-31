/** Lextron modules — editor behavior modules. */
import type { ScrollBlot } from 'lextron-dom';
import {
  Attributor,
  BlockBlot,
  ClassAttributor,
  EmbedBlot,
  Scope,
  StyleAttributor,
} from 'lextron-dom';
import ChangeSet from 'lextron-change';
import { BlockEmbed } from 'lextron-core/blots/block.js';
import type { EmitterSource } from 'lextron-core/core/emitter.js';
import logger from 'lextron-core/core/logger.js';
import Module from 'lextron-core/core/module.js';
import Lextron from 'lextron-core';
import type { Range } from 'lextron-core/core/selection.js';
import { AlignAttribute, AlignStyle } from 'lextron-formats/formats/align.js';
import { BackgroundStyle } from 'lextron-formats/formats/background.js';
import CodeBlock from 'lextron-formats/formats/code.js';
import { ColorStyle } from 'lextron-formats/formats/color.js';
import { DirectionAttribute, DirectionStyle } from 'lextron-formats/formats/direction.js';
import { FontStyle } from 'lextron-formats/formats/font.js';
import { SizeStyle } from 'lextron-formats/formats/size.js';
import { deleteRange } from './keyboard.js';
import normalizeExternalHTML from './normalizeExternalHTML/index.js';

const debug = logger('lextron:clipboard');

type Selector = string | Node['TEXT_NODE'] | Node['ELEMENT_NODE'];
type Matcher = (node: Node, delta: ChangeSet, scroll: ScrollBlot) => ChangeSet;

const CLIPBOARD_CONFIG: [Selector, Matcher][] = [
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
  ['b', createMatchAlias('bold')],
  ['i', createMatchAlias('italic')],
  ['strike', createMatchAlias('strike')],
  ['style', matchIgnore],
];

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

interface ClipboardOptions {
  matchers: [Selector, Matcher][];
}

class Clipboard extends Module<ClipboardOptions> {
  static DEFAULTS: ClipboardOptions = {
    matchers: [],
  };

  matchers: [Selector, Matcher][];

  constructor(lextron: Lextron, options: Partial<ClipboardOptions>) {
    super(lextron, options);
    this.lextron.root.addEventListener('copy', (e) =>
      this.onCaptureCopy(e, false),
    );
    this.lextron.root.addEventListener('cut', (e) => this.onCaptureCopy(e, true));
    this.lextron.root.addEventListener('paste', this.onCapturePaste.bind(this));
    this.matchers = [];
    CLIPBOARD_CONFIG.concat(this.options.matchers ?? []).forEach(
      ([selector, matcher]) => {
        this.addMatcher(selector, matcher);
      },
    );
  }

  addMatcher(selector: Selector, matcher: Matcher) {
    this.matchers.push([selector, matcher]);
  }

  convert(
    { html, text }: { html?: string; text?: string },
    formats: Record<string, unknown> = {},
  ) {
    if (formats[CodeBlock.blotName]) {
      return new ChangeSet().insert(text || '', {
        [CodeBlock.blotName]: formats[CodeBlock.blotName],
      });
    }
    if (!html) {
      return new ChangeSet().insert(text || '', formats);
    }
    const delta = this.convertHTML(html);
    // Remove trailing newline
    if (
      deltaEndsWith(delta, '\n') &&
      (delta.ops[delta.ops.length - 1].attributes == null || formats.table)
    ) {
      return delta.compose(new ChangeSet().retain(delta.length() - 1).delete(1));
    }
    return delta;
  }

  protected normalizeHTML(doc: Document) {
    normalizeExternalHTML(doc);
  }

  protected convertHTML(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    this.normalizeHTML(doc);
    const container = doc.body;
    const nodeMatches = new WeakMap();
    const [elementMatchers, textMatchers] = this.prepareMatching(
      container,
      nodeMatches,
    );
    return traverse(
      this.lextron.scroll,
      container,
      elementMatchers,
      textMatchers,
      nodeMatches,
    );
  }

  dangerouslyPasteHTML(html: string, source?: EmitterSource): void;
  dangerouslyPasteHTML(
    index: number,
    html: string,
    source?: EmitterSource,
  ): void;
  dangerouslyPasteHTML(
    index: number | string,
    html?: string,
    source: EmitterSource = Lextron.sources.API,
  ) {
    if (typeof index === 'string') {
      const delta = this.convert({ html: index, text: '' });
      // @ts-expect-error
      this.lextron.setContents(delta, html);
      this.lextron.setSelection(0, Lextron.sources.SILENT);
    } else {
      const paste = this.convert({ html, text: '' });
      this.lextron.updateContents(
        new ChangeSet().retain(index).concat(paste),
        source,
      );
      this.lextron.setSelection(index + paste.length(), Lextron.sources.SILENT);
    }
  }

  onCaptureCopy(e: ClipboardEvent, isCut = false) {
    if (e.defaultPrevented) return;
    e.preventDefault();
    const [range] = this.lextron.selection.getRange();
    if (range == null) return;
    const { html, text } = this.onCopy(range, isCut);
    e.clipboardData?.setData('text/plain', text);
    e.clipboardData?.setData('text/html', html);
    if (isCut) {
      deleteRange({ range, lextron: this.lextron });
    }
  }

  /*
   * https://www.iana.org/assignments/media-types/text/uri-list
   */
  private normalizeURIList(urlList: string) {
    return (
      urlList
        .split(/\r?\n/)
        // Ignore all comments
        .filter((url) => url[0] !== '#')
        .join('\n')
    );
  }

  onCapturePaste(e: ClipboardEvent) {
    if (e.defaultPrevented || !this.lextron.isEnabled()) return;
    e.preventDefault();
    const range = this.lextron.getSelection(true);
    if (range == null) return;
    const html = e.clipboardData?.getData('text/html');
    let text = e.clipboardData?.getData('text/plain');
    if (!html && !text) {
      const urlList = e.clipboardData?.getData('text/uri-list');
      if (urlList) {
        text = this.normalizeURIList(urlList);
      }
    }
    const files = Array.from(e.clipboardData?.files || []);
    if (!html && files.length > 0) {
      this.lextron.uploader.upload(range, files);
      return;
    }
    if (html && files.length > 0) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (
        doc.body.childElementCount === 1 &&
        doc.body.firstElementChild?.tagName === 'IMG'
      ) {
        this.lextron.uploader.upload(range, files);
        return;
      }
    }
    this.onPaste(range, { html, text });
  }

  onCopy(range: Range, isCut: boolean): { html: string; text: string };
  onCopy(range: Range) {
    const text = this.lextron.getText(range);
    const html = this.lextron.getSemanticHTML(range);
    return { html, text };
  }

  onPaste(range: Range, { text, html }: { text?: string; html?: string }) {
    const formats = this.lextron.getFormat(range.index);
    const pastedChangeSet = this.convert({ text, html }, formats);
    debug.log('onPaste', pastedChangeSet, { text, html });
    const delta = new ChangeSet()
      .retain(range.index)
      .delete(range.length)
      .concat(pastedChangeSet);
    this.lextron.updateContents(delta, Lextron.sources.USER);
    // range.length contributes to delta.length()
    this.lextron.setSelection(
      delta.length() - range.length,
      Lextron.sources.SILENT,
    );
    this.lextron.scrollSelectionIntoView();
  }

  prepareMatching(container: Element, nodeMatches: WeakMap<Node, Matcher[]>) {
    const elementMatchers: Matcher[] = [];
    const textMatchers: Matcher[] = [];
    this.matchers.forEach((pair) => {
      const [selector, matcher] = pair;
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
              const matches = nodeMatches.get(node);
              matches?.push(matcher);
            } else {
              nodeMatches.set(node, [matcher]);
            }
          });
          break;
      }
    });
    return [elementMatchers, textMatchers];
  }
}

function applyFormat(
  delta: ChangeSet,
  format: string,
  value: unknown,
  scroll: ScrollBlot,
): ChangeSet {
  if (!scroll.query(format)) {
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

function deltaEndsWith(delta: ChangeSet, text: string) {
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

function isLine(node: Node, scroll: ScrollBlot) {
  if (!(node instanceof Element)) return false;
  const match = scroll.query(node);
  // @ts-expect-error
  if (match && match.prototype instanceof EmbedBlot) return false;

  return [
    'address',
    'article',
    'blockquote',
    'canvas',
    'dd',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'iframe',
    'li',
    'main',
    'nav',
    'ol',
    'output',
    'p',
    'pre',
    'section',
    'table',
    'td',
    'tr',
    'ul',
    'video',
  ].includes(node.tagName.toLowerCase());
}

function isBetweenInlineElements(node: HTMLElement, scroll: ScrollBlot) {
  return (
    node.previousElementSibling &&
    node.nextElementSibling &&
    !isLine(node.previousElementSibling, scroll) &&
    !isLine(node.nextElementSibling, scroll)
  );
}

const preNodes = new WeakMap();
function isPre(node: Node | null) {
  if (node == null) return false;
  if (!preNodes.has(node)) {
    // @ts-expect-error
    if (node.tagName === 'PRE') {
      preNodes.set(node, true);
    } else {
      preNodes.set(node, isPre(node.parentNode));
    }
  }
  return preNodes.get(node);
}

function traverse(
  scroll: ScrollBlot,
  node: ChildNode,
  elementMatchers: Matcher[],
  textMatchers: Matcher[],
  nodeMatches: WeakMap<Node, Matcher[]>,
): ChangeSet {
  // Post-order
  if (node.nodeType === node.TEXT_NODE) {
    return textMatchers.reduce((delta: ChangeSet, matcher) => {
      return matcher(node, delta, scroll);
    }, new ChangeSet());
  }
  if (node.nodeType === node.ELEMENT_NODE) {
    return Array.from(node.childNodes || []).reduce((delta, childNode) => {
      let childrenChangeSet = traverse(
        scroll,
        childNode,
        elementMatchers,
        textMatchers,
        nodeMatches,
      );
      if (childNode.nodeType === node.ELEMENT_NODE) {
        childrenChangeSet = elementMatchers.reduce((reducedChangeSet, matcher) => {
          return matcher(childNode as HTMLElement, reducedChangeSet, scroll);
        }, childrenChangeSet);
        childrenChangeSet = (nodeMatches.get(childNode) || []).reduce(
          (reducedChangeSet, matcher) => {
            return matcher(childNode, reducedChangeSet, scroll);
          },
          childrenChangeSet,
        );
      }
      return delta.concat(childrenChangeSet);
    }, new ChangeSet());
  }
  return new ChangeSet();
}

function createMatchAlias(format: string) {
  return (_node: Element, delta: ChangeSet, scroll: ScrollBlot) => {
    return applyFormat(delta, format, true, scroll);
  };
}

function matchAttributor(node: HTMLElement, delta: ChangeSet, scroll: ScrollBlot) {
  const attributes = Attributor.keys(node);
  const classes = ClassAttributor.keys(node);
  const styles = StyleAttributor.keys(node);
  const formats: Record<string, string | undefined> = {};
  attributes
    .concat(classes)
    .concat(styles)
    .forEach((name) => {
      let attr = scroll.query(name, Scope.ATTRIBUTE) as Attributor;
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
        attr = STYLE_ATTRIBUTORS[name];
        formats[attr.attrName] = attr.value(node) || undefined;
      }
    });

  return Object.entries(formats).reduce(
    (newChangeSet, [name, value]) => applyFormat(newChangeSet, name, value, scroll),
    delta,
  );
}

function matchBlot(node: Node, delta: ChangeSet, scroll: ScrollBlot) {
  const match = scroll.query(node);
  if (match == null) return delta;
  // @ts-expect-error
  if (match.prototype instanceof EmbedBlot) {
    const embed = {};
    // @ts-expect-error
    const value = match.value(node);
    if (value != null) {
      // @ts-expect-error
      embed[match.blotName] = value;
      // @ts-expect-error
      return new ChangeSet().insert(embed, match.formats(node, scroll));
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
        match.formats(node, scroll),
        scroll,
      );
    }
  }
  return delta;
}

function matchBreak(node: Node, delta: ChangeSet) {
  if (!deltaEndsWith(delta, '\n')) {
    delta.insert('\n');
  }
  return delta;
}

function matchCodeBlock(node: Node, delta: ChangeSet, scroll: ScrollBlot) {
  const match = scroll.query('code-block');
  const language =
    match && 'formats' in match && typeof match.formats === 'function'
      ? match.formats(node, scroll)
      : true;
  return applyFormat(delta, 'code-block', language, scroll);
}

function matchIgnore() {
  return new ChangeSet();
}

function matchIndent(node: Node, delta: ChangeSet, scroll: ScrollBlot) {
  const match = scroll.query(node);
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
    // @ts-expect-error
    if (['OL', 'UL'].includes(parent.tagName)) {
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
}

function matchList(node: Node, delta: ChangeSet, scroll: ScrollBlot) {
  const element = node as Element;
  let list = element.tagName === 'OL' ? 'ordered' : 'bullet';

  const checkedAttr = element.getAttribute('data-checked');
  if (checkedAttr) {
    list = checkedAttr === 'true' ? 'checked' : 'unchecked';
  }

  return applyFormat(delta, 'list', list, scroll);
}

function matchNewline(node: Node, delta: ChangeSet, scroll: ScrollBlot) {
  if (!deltaEndsWith(delta, '\n')) {
    if (
      isLine(node, scroll) &&
      (node.childNodes.length > 0 || node instanceof HTMLParagraphElement)
    ) {
      return delta.insert('\n');
    }
    if (delta.length() > 0 && node.nextSibling) {
      let nextSibling: Node | null = node.nextSibling;
      while (nextSibling != null) {
        if (isLine(nextSibling, scroll)) {
          return delta.insert('\n');
        }
        const match = scroll.query(nextSibling);
        // @ts-expect-error
        if (match && match.prototype instanceof BlockEmbed) {
          return delta.insert('\n');
        }
        nextSibling = nextSibling.firstChild;
      }
    }
  }
  return delta;
}

function matchStyles(node: HTMLElement, delta: ChangeSet, scroll: ScrollBlot) {
  const formats: Record<string, unknown> = {};
  const style: Partial<CSSStyleDeclaration> = node.style || {};
  if (style.fontStyle === 'italic') {
    formats.italic = true;
  }
  if (style.textDecoration === 'underline') {
    formats.underline = true;
  }
  if (style.textDecoration === 'line-through') {
    formats.strike = true;
  }
  if (
    style.fontWeight?.startsWith('bold') ||
    // @ts-expect-error Fix me later
    parseInt(style.fontWeight, 10) >= 700
  ) {
    formats.bold = true;
  }
  delta = Object.entries(formats).reduce(
    (newChangeSet, [name, value]) => applyFormat(newChangeSet, name, value, scroll),
    delta,
  );
  // @ts-expect-error
  if (parseFloat(style.textIndent || 0) > 0) {
    // Could be 0.5in
    return new ChangeSet().insert('\t').concat(delta);
  }
  return delta;
}

function matchTable(
  node: HTMLTableRowElement,
  delta: ChangeSet,
  scroll: ScrollBlot,
) {
  const table =
    node.parentElement?.tagName === 'TABLE'
      ? node.parentElement
      : node.parentElement?.parentElement;
  if (table != null) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const row = rows.indexOf(node) + 1;
    return applyFormat(delta, 'table', row, scroll);
  }
  return delta;
}

function matchText(node: HTMLElement, delta: ChangeSet, scroll: ScrollBlot) {
  // @ts-expect-error
  let text = node.data as string;
  // Word represents empty line with <o:p>&nbsp;</o:p>
  if (node.parentElement?.tagName === 'O:P') {
    return delta.insert(text.trim());
  }
  if (!isPre(node)) {
    if (
      text.trim().length === 0 &&
      text.includes('\n') &&
      !isBetweenInlineElements(node, scroll)
    ) {
      return delta;
    }
    // convert all non-nbsp whitespace into regular space
    text = text.replace(/[^\S\u00a0]/g, ' ');
    // collapse consecutive spaces into one
    text = text.replace(/ {2,}/g, ' ');
    if (
      (node.previousSibling == null &&
        node.parentElement != null &&
        isLine(node.parentElement, scroll)) ||
      (node.previousSibling instanceof Element &&
        isLine(node.previousSibling, scroll))
    ) {
      // block structure means we don't need leading space
      text = text.replace(/^ /, '');
    }
    if (
      (node.nextSibling == null &&
        node.parentElement != null &&
        isLine(node.parentElement, scroll)) ||
      (node.nextSibling instanceof Element && isLine(node.nextSibling, scroll))
    ) {
      // block structure means we don't need trailing space
      text = text.replace(/ $/, '');
    }
    // done removing whitespace and can normalize all to regular space
    text = text.replaceAll('\u00a0', ' ');
  }
  return delta.insert(text);
}

export {
  Clipboard as default,
  matchAttributor,
  matchBlot,
  matchNewline,
  matchText,
  traverse,
};
