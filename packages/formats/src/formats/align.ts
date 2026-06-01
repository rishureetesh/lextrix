/** Lextrix formats — built-in text and block formats. */
import {
  defineAttributeAttributorFormat,
  defineAttributorGroup,
  defineClassAttributorFormat,
  defineStyleAttributorFormat,
  Scope,
} from '../attributor-format.js';

const config = {
  scope: Scope.BLOCK,
  whitelist: ['right', 'center', 'justify'],
};

const AlignAttribute = defineAttributeAttributorFormat('align', 'align', config);
const AlignClass = defineClassAttributorFormat('align', 'lxr-align', config);
const AlignStyle = defineStyleAttributorFormat('align', 'text-align', config);

defineAttributorGroup('align', [AlignClass, AlignStyle]);

export { AlignAttribute, AlignClass, AlignStyle };
