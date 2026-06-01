import { ParentBlot } from 'lextrix-dom';
import type { Blot } from 'lextrix-dom';
import TextBlot, { escapeText } from '../../blots/text.js';

interface ListItem {
  child: Blot;
  offset: number;
  length: number;
  indent: number;
  type: string;
}

function listTag(type: string | undefined): [string, string] {
  const tag = type === 'ordered' ? 'ol' : 'ul';
  switch (type) {
    case 'checked':
      return [tag, ' data-list="checked"'];
    case 'unchecked':
      return [tag, ' data-list="unchecked"'];
    default:
      return [tag, ''];
  }
}

export function serializeListHtml(
  items: ListItem[],
  lastIndent: number,
  types: string[],
): string {
  if (items.length === 0) {
    const [endTag] = listTag(types.pop());
    if (lastIndent <= 0) {
      return `</li></${endTag}>`;
    }
    return `</li></${endTag}>${serializeListHtml([], lastIndent - 1, types)}`;
  }
  const [{ child, offset, length, indent, type }, ...rest] = items;
  const [tag, attribute] = listTag(type);
  if (indent > lastIndent) {
    types.push(type);
    if (indent === lastIndent + 1) {
      return `<${tag}><li${attribute}>${serializeNodeHtml(
        child,
        offset,
        length,
      )}${serializeListHtml(rest, indent, types)}`;
    }
    return `<${tag}><li>${serializeListHtml(items, lastIndent + 1, types)}`;
  }
  const previousType = types[types.length - 1];
  if (indent === lastIndent && type === previousType) {
    return `</li><li${attribute}>${serializeNodeHtml(
      child,
      offset,
      length,
    )}${serializeListHtml(rest, indent, types)}`;
  }
  const [endTag] = listTag(types.pop());
  return `</li></${endTag}>${serializeListHtml(items, lastIndent - 1, types)}`;
}

export function serializeNodeHtml(
  blot: Blot,
  index: number,
  length: number,
  isRoot = false,
): string {
  if ('html' in blot && typeof blot.html === 'function') {
    return blot.html(index, length);
  }
  if (blot instanceof TextBlot) {
    return escapeText(blot.value().slice(index, index + length)).replaceAll(
      ' ',
      '&nbsp;',
    );
  }
  if (blot instanceof ParentBlot) {
    if (blot.statics.blotName === 'list-container') {
      const items: ListItem[] = [];
      blot.children.forEachAt(index, length, (child, offset, childLength) => {
        const formats =
          'formats' in child && typeof child.formats === 'function'
            ? child.formats()
            : {};
        items.push({
          child,
          offset,
          length: childLength,
          indent: (formats as { indent?: number }).indent || 0,
          type: (formats as { list?: string }).list || '',
        });
      });
      return serializeListHtml(items, -1, []);
    }
    const parts: string[] = [];
    blot.children.forEachAt(index, length, (child, offset, childLength) => {
      parts.push(serializeNodeHtml(child, offset, childLength));
    });
    if (isRoot || blot.statics.blotName === 'list') {
      return parts.join('');
    }
    const { outerHTML, innerHTML } = blot.domNode as Element;
    const [start, end] = outerHTML.split(`>${innerHTML}<`);
    if (start === '<table') {
      return `<table style="border: 1px solid #000;">${parts.join('')}<${end}`;
    }
    return `${start}>${parts.join('')}<${end}`;
  }
  return blot.domNode instanceof Element ? blot.domNode.outerHTML : '';
}
