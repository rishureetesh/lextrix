/** Lextrix modules — editor behavior modules. */
import ChangeSet from 'lextrix-change';
import type { EmitterSource } from 'lextrix-core/core/emitter.js';
import logger from 'lextrix-core/core/logger.js';
import Module from 'lextrix-core/core/module.js';
import Lextrix from 'lextrix-core';
import type { Range } from 'lextrix-core/core/selection.js';
import CodeBlock from 'lextrix-formats/formats/code.js';
import { deleteRange } from './keyboard.js';
import normalizeExternalHTML from './normalizeExternalHTML/index.js';
import {
  importHtml,
  type HtmlMatcher,
  type HtmlSelector,
} from '../html-import/index.js';

const debug = logger('lextrix:clipboard');

interface ClipboardOptions {
  matchers: [HtmlSelector, HtmlMatcher][];
}

class Clipboard extends Module<ClipboardOptions> {
  static DEFAULTS: ClipboardOptions = {
    matchers: [],
  };

  matchers: [HtmlSelector, HtmlMatcher][];

  constructor(lextrix: Lextrix, options: Partial<ClipboardOptions>) {
    super(lextrix, options);
    this.lextrix.root.addEventListener('copy', (e) =>
      this.onCaptureCopy(e, false),
    );
    this.lextrix.root.addEventListener('cut', (e) => this.onCaptureCopy(e, true));
    this.lextrix.root.addEventListener('paste', this.onCapturePaste.bind(this));
    this.matchers = options.matchers ?? [];
  }

  addMatcher(selector: HtmlSelector, matcher: HtmlMatcher) {
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
    return importHtml(html, this.lextrix.scroll, {
      matchers: this.matchers,
      normalizeDocument: normalizeExternalHTML,
      stripTrailingNewline: formats.table == null,
    });
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
    source: EmitterSource = Lextrix.sources.API,
  ) {
    if (typeof index === 'string') {
      const delta = this.convert({ html: index, text: '' });
      // @ts-expect-error
      this.lextrix.setContents(delta, html);
      this.lextrix.setSelection(0, Lextrix.sources.SILENT);
    } else {
      const paste = this.convert({ html, text: '' });
      this.lextrix.updateContents(
        new ChangeSet().retain(index).concat(paste),
        source,
      );
      this.lextrix.setSelection(index + paste.length(), Lextrix.sources.SILENT);
    }
  }

  onCaptureCopy(e: ClipboardEvent, isCut = false) {
    if (e.defaultPrevented) return;
    e.preventDefault();
    const [range] = this.lextrix.selection.getRange();
    if (range == null) return;
    const { html, text } = this.onCopy(range, isCut);
    e.clipboardData?.setData('text/plain', text);
    e.clipboardData?.setData('text/html', html);
    if (isCut) {
      deleteRange({ range, lextrix: this.lextrix });
    }
  }

  private normalizeURIList(urlList: string) {
    return urlList
      .split(/\r?\n/)
      .filter((url) => url[0] !== '#')
      .join('\n');
  }

  onCapturePaste(e: ClipboardEvent) {
    if (e.defaultPrevented || !this.lextrix.isEnabled()) return;
    e.preventDefault();
    const range = this.lextrix.getSelection(true);
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
      this.lextrix.uploader.upload(range, files);
      return;
    }
    if (html && files.length > 0) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (
        doc.body.childElementCount === 1 &&
        doc.body.firstElementChild?.tagName === 'IMG'
      ) {
        this.lextrix.uploader.upload(range, files);
        return;
      }
    }
    this.onPaste(range, { html, text });
  }

  onCopy(range: Range, isCut: boolean): { html: string; text: string };
  onCopy(range: Range) {
    const text = this.lextrix.getText(range);
    const html = this.lextrix.getSemanticHTML(range);
    return { html, text };
  }

  onPaste(range: Range, { text, html }: { text?: string; html?: string }) {
    const formats = this.lextrix.getFormat(range.index);
    const pastedChangeSet = this.convert({ text, html }, formats);
    debug.log('onPaste', pastedChangeSet, { text, html });
    const delta = new ChangeSet()
      .retain(range.index)
      .delete(range.length)
      .concat(pastedChangeSet);
    this.lextrix.updateContents(delta, Lextrix.sources.USER);
    this.lextrix.setSelection(
      delta.length() - range.length,
      Lextrix.sources.SILENT,
    );
    this.lextrix.scrollSelectionIntoView();
  }
}

export { Clipboard as default };
