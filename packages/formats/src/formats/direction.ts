/** Lextrix formats — built-in text and block formats. */
import {
  defineAttributorGroup,
  defineAttributeAttributorFormat,
  defineClassAttributorFormat,
  defineStyleAttributorFormat,
  Scope,
} from '../attributor-format.js';

const config = {
  scope: Scope.BLOCK,
  whitelist: ['rtl'],
};

const DirectionAttribute = defineAttributeAttributorFormat(
  'direction',
  'dir',
  config,
);
const DirectionClass = defineClassAttributorFormat(
  'direction',
  'lxr-direction',
  config,
);
const DirectionStyle = defineStyleAttributorFormat('direction', 'direction', config);

defineAttributorGroup('direction', [
  DirectionClass,
  DirectionStyle,
  DirectionAttribute,
]);

export { DirectionAttribute, DirectionClass, DirectionStyle };
