/** Lextrix formats — built-in text and block formats. */
import { ClassAttributor } from 'lextrix-dom';
import { defineAttributorGroup, registerAttributorFormat, Scope } from '../attributor-format.js';

class IndentAttributor extends ClassAttributor {
  add(node: HTMLElement, value: string | number) {
    let normalizedValue = 0;
    if (value === '+1' || value === '-1') {
      const indent = this.value(node) || 0;
      normalizedValue = value === '+1' ? indent + 1 : indent - 1;
    } else if (typeof value === 'number') {
      normalizedValue = value;
    }
    if (normalizedValue === 0) {
      this.remove(node);
      return true;
    }
    return super.add(node, normalizedValue.toString());
  }

  canAdd(node: HTMLElement, value: string) {
    return super.canAdd(node, value) || super.canAdd(node, parseInt(value, 10));
  }

  value(node: HTMLElement) {
    return parseInt(super.value(node), 10) || undefined;
  }
}

const IndentClass = registerAttributorFormat(
  new IndentAttributor('indent', 'lxr-indent', {
    scope: Scope.BLOCK,
    // @ts-expect-error whitelist accepts numeric indent levels
    whitelist: [1, 2, 3, 4, 5, 6, 7, 8],
  }),
);

defineAttributorGroup('indent', [IndentClass]);

export default IndentClass;
