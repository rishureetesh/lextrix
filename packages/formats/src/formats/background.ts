/** Lextrix formats — built-in text and block formats. */
import { ColorAttributor } from './color.js';
import {
  defineAttributorGroup,
  defineClassAttributorFormat,
  registerAttributorFormat,
  Scope,
} from '../attributor-format.js';

const BackgroundClass = defineClassAttributorFormat('background', 'lxr-bg', {
  scope: Scope.INLINE,
});
const BackgroundStyle = registerAttributorFormat(
  new ColorAttributor('background', 'background-color', {
    scope: Scope.INLINE,
  }),
);

defineAttributorGroup('background', [BackgroundClass, BackgroundStyle]);

export { BackgroundClass, BackgroundStyle };
