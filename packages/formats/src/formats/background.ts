/** Lextron formats — built-in text and block formats. */
import { ClassAttributor, Scope } from 'lextron-dom';
import { ColorAttributor } from './color.js';

const BackgroundClass = new ClassAttributor('background', 'lxt-bg', {
  scope: Scope.INLINE,
});
const BackgroundStyle = new ColorAttributor('background', 'background-color', {
  scope: Scope.INLINE,
});

export { BackgroundClass, BackgroundStyle };
