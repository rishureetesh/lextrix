import DomError from '../error.js';
import type { BlotConstructor } from '../blot/abstract/blot.js';

/** Creates DOM elements from blot static metadata. */
export class NodeElementFactory {
  static createFromBlot(
    blotClass: BlotConstructor,
    rawValue?: unknown,
  ): HTMLElement {
    const tagName = blotClass.tagName;
    if (tagName == null) {
      throw new DomError('Blot definition missing tagName');
    }

    let node: HTMLElement;
    if (Array.isArray(tagName)) {
      let value: string | number | undefined;
      if (typeof rawValue === 'string') {
        value = rawValue.toUpperCase();
        if (parseInt(value, 10).toString() === value) {
          value = parseInt(value, 10);
        }
      } else if (typeof rawValue === 'number') {
        value = rawValue;
      }
      if (typeof value === 'number') {
        node = document.createElement(tagName[value - 1]);
      } else if (value && tagName.indexOf(value) > -1) {
        node = document.createElement(value);
      } else {
        node = document.createElement(tagName[0]);
      }
    } else {
      node = document.createElement(tagName);
    }

    if (blotClass.className) {
      node.classList.add(blotClass.className);
    }
    return node;
  }
}

export default NodeElementFactory;
