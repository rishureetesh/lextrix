/** Lextrix formats — built-in text and block formats. */
import { defineInlineTagFormat } from '../inline-format.js';
import { registerFormatGroup } from '../block-format.js';

const Script = defineInlineTagFormat({
  blotName: 'script',
  tagName: ['SUB', 'SUP'],
  create(value) {
    if (value === 'super') {
      return document.createElement('sup');
    }
    if (value === 'sub') {
      return document.createElement('sub');
    }
    return undefined!;
  },
  formats(domNode) {
    if (domNode.tagName === 'SUB') return 'sub';
    if (domNode.tagName === 'SUP') return 'super';
    return undefined;
  },
});

registerFormatGroup('script', [Script]);

export default Script;
