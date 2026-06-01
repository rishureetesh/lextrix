/** Lextrix formats — built-in text and block formats. */
import {
  defineAttributorGroup,
  defineClassAttributorFormat,
  defineStyleAttributorFormat,
  Scope,
} from '../attributor-format.js';

const SizeClass = defineClassAttributorFormat('size', 'lxr-size', {
  scope: Scope.INLINE,
  whitelist: ['small', 'large', 'huge'],
});
const SizeStyle = defineStyleAttributorFormat('size', 'font-size', {
  scope: Scope.INLINE,
  whitelist: ['10px', '18px', '32px'],
});

defineAttributorGroup('size', [SizeClass, SizeStyle]);

export { SizeClass, SizeStyle };
