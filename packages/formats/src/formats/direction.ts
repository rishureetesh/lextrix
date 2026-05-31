/** Lextron formats — built-in text and block formats. */
import { Attributor, ClassAttributor, Scope, StyleAttributor } from 'lextron-dom';

const config = {
  scope: Scope.BLOCK,
  whitelist: ['rtl'],
};

const DirectionAttribute = new Attributor('direction', 'dir', config);
const DirectionClass = new ClassAttributor('direction', 'lxt-direction', config);
const DirectionStyle = new StyleAttributor('direction', 'direction', config);

export { DirectionAttribute, DirectionClass, DirectionStyle };
