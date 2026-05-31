/** Lextron formats — built-in text and block formats. */
import Bold from './bold.js';

class Strike extends Bold {
  static blotName = 'strike';
  static tagName = ['S', 'STRIKE'];
}

export default Strike;
