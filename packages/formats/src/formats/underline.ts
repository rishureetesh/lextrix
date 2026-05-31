/** Lextron formats — built-in text and block formats. */
import Inline from 'lextron-core/blots/inline.js';

class Underline extends Inline {
  static blotName = 'underline';
  static tagName = 'U';
}

export default Underline;
