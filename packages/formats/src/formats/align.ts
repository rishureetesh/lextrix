/** Lextrix formats � built-in text and block formats. */
import { Attributor, ClassAttributor, Scope, StyleAttributor } from 'lextrix-dom';

const config = {
  scope: Scope.BLOCK,
  whitelist: ['right', 'center', 'justify'],
};

const AlignAttribute = new Attributor('align', 'align', config);
const AlignClass = new ClassAttributor('align', 'lxr-align', config);
const AlignStyle = new StyleAttributor('align', 'text-align', config);

export { AlignAttribute, AlignClass, AlignStyle };
