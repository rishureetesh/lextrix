/** Lextron formats — built-in text and block formats. */
import { ClassAttributor, Scope, StyleAttributor } from 'lextron-dom';

const SizeClass = new ClassAttributor('size', 'lxt-size', {
  scope: Scope.INLINE,
  whitelist: ['small', 'large', 'huge'],
});
const SizeStyle = new StyleAttributor('size', 'font-size', {
  scope: Scope.INLINE,
  whitelist: ['10px', '18px', '32px'],
});

export { SizeClass, SizeStyle };
