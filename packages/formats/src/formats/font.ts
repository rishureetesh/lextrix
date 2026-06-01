/** Lextrix formats — built-in text and block formats. */
import { StyleAttributor } from 'lextrix-dom';
import {
  defineAttributorGroup,
  defineClassAttributorFormat,
  registerAttributorFormat,
  Scope,
} from '../attributor-format.js';

const config = {
  scope: Scope.INLINE,
  whitelist: ['serif', 'monospace'],
};

const FontClass = defineClassAttributorFormat('font', 'lxr-font', config);

class FontStyleAttributor extends StyleAttributor {
  value(node: HTMLElement) {
    return super.value(node).replace(/["']/g, '');
  }
}

const FontStyle = registerAttributorFormat(
  new FontStyleAttributor('font', 'font-family', config),
);

defineAttributorGroup('font', [FontClass, FontStyle]);

export { FontStyle, FontClass };
