import type Lextrix from 'lextrix-core';
import type { Bounds } from 'lextrix-core/core/selection.js';

const isScrollable = (el: Element) => {
  const { overflowY } = getComputedStyle(el, null);
  return overflowY !== 'visible' && overflowY !== 'clip';
};

class Tooltip {
  lextrix: Lextrix;
  boundsContainer: HTMLElement;
  root: HTMLDivElement;

  constructor(lextrix: Lextrix, boundsContainer?: HTMLElement) {
    this.lextrix = lextrix;
    this.boundsContainer = boundsContainer || document.body;
    this.root = lextrix.addContainer('lxr-tooltip');
    // @ts-expect-error
    this.root.innerHTML = this.constructor.TEMPLATE;
    if (isScrollable(this.lextrix.root)) {
      this.lextrix.root.addEventListener('scroll', () => {
        this.root.style.marginTop = `${-1 * this.lextrix.root.scrollTop}px`;
      });
    }
    this.hide();
  }

  hide() {
    this.root.classList.add('lxr-hidden');
  }

  position(reference: Bounds) {
    const left =
      reference.left + reference.width / 2 - this.root.offsetWidth / 2;
    // root.scrollTop should be 0 if scrollContainer !== root
    const top = reference.bottom + this.lextrix.root.scrollTop;
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
    this.root.classList.remove('lxr-flip');
    const containerBounds = this.boundsContainer.getBoundingClientRect();
    const rootBounds = this.root.getBoundingClientRect();
    let shift = 0;
    if (rootBounds.right > containerBounds.right) {
      shift = containerBounds.right - rootBounds.right;
      this.root.style.left = `${left + shift}px`;
    }
    if (rootBounds.left < containerBounds.left) {
      shift = containerBounds.left - rootBounds.left;
      this.root.style.left = `${left + shift}px`;
    }
    if (rootBounds.bottom > containerBounds.bottom) {
      const height = rootBounds.bottom - rootBounds.top;
      const verticalShift = reference.bottom - reference.top + height;
      this.root.style.top = `${top - verticalShift}px`;
      this.root.classList.add('lxr-flip');
    }
    return shift;
  }

  show() {
    this.root.classList.remove('lxr-editing');
    this.root.classList.remove('lxr-hidden');
  }
}

export default Tooltip;
