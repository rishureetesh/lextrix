import Inline from 'lextrix-core/blots/inline.js';
import type { Blot } from 'lextrix-dom';
import {
  defineDocumentFormat,
  type DocumentFormatDefinition,
} from './format-definition.js';

type InlineFormatConfig = {
  blotName: string;
  tagName: string | string[];
  create?: (value?: string) => HTMLElement;
  formats?: (domNode: HTMLElement) => unknown;
  optimize?: DocumentFormatDefinition['optimize'];
};

/** Registers an inline format blot + DocumentNode definition together. */
export function defineInlineTagFormat(config: InlineFormatConfig) {
  class FormatBlot extends Inline {
    static blotName = config.blotName;
    static tagName = config.tagName;

    static create(value?: string) {
      if (config.create) {
        const created = config.create(value);
        if (created != null) {
          return created;
        }
      }
      return super.create(value) as HTMLElement;
    }

    static formats(domNode: HTMLElement) {
      if (config.formats) {
        return config.formats(domNode);
      }
      return true;
    }
  }

  defineDocumentFormat(FormatBlot, {
    optimize:
      config.optimize ??
      ((blot: Blot) => {
        const tag = (blot.domNode as HTMLElement).tagName;
        const expected = Array.isArray(FormatBlot.tagName)
          ? FormatBlot.tagName
          : [FormatBlot.tagName];
        if (!expected.includes(tag)) {
          blot.replaceWith(FormatBlot.blotName, true);
        }
      }),
  });

  return FormatBlot;
}

export default defineInlineTagFormat;
