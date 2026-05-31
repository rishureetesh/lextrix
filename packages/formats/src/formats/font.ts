/** Lextron formats — built-in text and block formats. */
import { ClassAttributor, Scope, StyleAttributor } from 'lextron-dom';

const config = {
  scope: Scope.INLINE,
  whitelist: ['serif', 'monospace'],
};

const FontClass = new ClassAttributor('font', 'lxt-font', config);

class FontStyleAttributor extends StyleAttributor {
  value(node: HTMLElement) {
    return super.value(node).replace(/["']/g, '');
  }
}

const FontStyle = new FontStyleAttributor('font', 'font-family', config);

export { FontStyle, FontClass };
