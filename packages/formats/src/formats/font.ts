/** Lextrix formats � built-in text and block formats. */
import { ClassAttributor, Scope, StyleAttributor } from 'lextrix-dom';

const config = {
  scope: Scope.INLINE,
  whitelist: ['serif', 'monospace'],
};

const FontClass = new ClassAttributor('font', 'lxr-font', config);

class FontStyleAttributor extends StyleAttributor {
  value(node: HTMLElement) {
    return super.value(node).replace(/["']/g, '');
  }
}

const FontStyle = new FontStyleAttributor('font', 'font-family', config);

export { FontStyle, FontClass };
