import Inline from 'lextrix-core/blots/inline.js';
import { defineDocumentFormat } from './format-definition.js';
type LinkFormatConfig = {
  sanitize: (url: string, protocols: string[]) => boolean;
  protocolWhitelist: string[];
};

/** Registers link format with URL sanitization in the definition registry. */
export function defineLinkFormat(config: LinkFormatConfig) {
  class Link extends Inline {
    static blotName = 'link';
    static tagName = 'A';
    static SANITIZED_URL = 'about:blank';
    static PROTOCOL_WHITELIST = config.protocolWhitelist;

    static create(value: string) {
      const node = super.create(value) as HTMLElement;
      node.setAttribute('href', Link.sanitize(value));
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
      return node;
    }

    static formats(domNode: HTMLElement) {
      return domNode.getAttribute('href');
    }

    static sanitize(url: string) {
      return config.sanitize(url, Link.PROTOCOL_WHITELIST)
        ? url
        : Link.SANITIZED_URL;
    }

    format(name: string, value: unknown) {
      if (name !== Link.blotName || !value) {
        super.format(name, value);
      } else {
        this.domNode.setAttribute(
          'href',
          Link.sanitize(String(value)),
        );
      }
    }
  }

  defineDocumentFormat(Link, {
    tagName: 'A',
  });

  return Link;
}

export function sanitizeUrl(url: string, protocols: string[]) {
  const anchor = document.createElement('a');
  anchor.href = url;
  const protocol = anchor.href.slice(0, anchor.href.indexOf(':'));
  return protocols.indexOf(protocol) > -1;
}

export default defineLinkFormat;
