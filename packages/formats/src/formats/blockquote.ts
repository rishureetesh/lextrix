/** Lextrix formats — built-in text and block formats. */
import { defineBlockFormat } from '../block-format.js';
import { registerFormatGroup } from '../block-format.js';

const Blockquote = defineBlockFormat({
  blotName: 'blockquote',
  tagName: 'blockquote',
});

registerFormatGroup('blockquote', [Blockquote]);

export default Blockquote;
