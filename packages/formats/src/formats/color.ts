/** Lextrix formats — built-in text and block formats. */
import { ClassAttributor, StyleAttributor } from 'lextrix-dom';
import {
  defineAttributorGroup,
  registerAttributorFormat,
  Scope,
} from '../attributor-format.js';

class ColorAttributor extends StyleAttributor {
  value(domNode: HTMLElement) {
    let value = super.value(domNode) as string;
    if (!value.startsWith('rgb(')) return value;
    value = value.replace(/^[^\d]+/, '').replace(/[^\d]+$/, '');
    const hex = value
      .split(',')
      .map((component) => `00${parseInt(component, 10).toString(16)}`.slice(-2))
      .join('');
    return `#${hex}`;
  }
}

const ColorClass = registerAttributorFormat(
  new ClassAttributor('color', 'lxr-color', {
    scope: Scope.INLINE,
  }),
);
const ColorStyle = registerAttributorFormat(
  new ColorAttributor('color', 'color', {
    scope: Scope.INLINE,
  }),
);

defineAttributorGroup('color', [ColorClass, ColorStyle]);

export { ColorAttributor, ColorClass, ColorStyle };
