import ChangeSet from 'lextrix-change';
import type { ContentSerializer, SerializerFactory } from '../types.js';

export interface HtmlSerializerOptions {
  /** Wrap exported HTML in a container element. */
  wrap?: boolean;
}

/** HTML serializer — delegates to the editor adapter for DOM-aware conversion. */
export function htmlSerializer(
  options: Partial<HtmlSerializerOptions> = {},
): ContentSerializer {
  const { wrap = false } = options;

  return {
    format: 'html',

    import(content: string, context): ChangeSet {
      const convert = context?.adapter?.convertHtml;
      if (!convert) {
        throw new Error(
          'HTML import requires an editor adapter with convertHtml(). ' +
            'Bind a Lextrix editor or provide a custom HTML importer.',
        );
      }
      return convert(content);
    },

    export(_changeSet, context): string {
      const exportHtml = context?.adapter?.exportHtml;
      if (!exportHtml) {
        throw new Error(
          'HTML export requires an editor adapter with exportHtml(). ' +
            'Bind a Lextrix editor or provide a custom HTML exporter.',
        );
      }
      const range = context?.exportRange;
      const html =
        range != null
          ? exportHtml(range.index, range.length)
          : exportHtml();
      if (!wrap) return html;
      return `<div class="lxr-export">${html}</div>`;
    },
  };
}

export const createHtmlSerializer: SerializerFactory<HtmlSerializerOptions> =
  htmlSerializer;
