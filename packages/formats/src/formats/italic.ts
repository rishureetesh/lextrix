/** Lextrix formats � built-in text and block formats. */
import Bold from './bold.js';

class Italic extends Bold {
  static blotName = 'italic';
  static tagName = ['EM', 'I'];
}

export default Italic;
