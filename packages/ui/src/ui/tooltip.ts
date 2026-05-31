import type Lextron from 'lextron-core';
import type { Bounds } from 'lextron-core/core/selection.js';

const isScrollable = (el: Element) => {
  const { overflowY } = getComputedStyle(el, null);
  return overflowY !== 'visible' && overflowY !== 'clip';
};

class Tooltip {
  lextron: Lextron;
  boundsContainer: HTMLElement;
  root: HTMLDivElement;

  constructor(lextron: Lextron, boundsContainer?: HTMLElement) {
    this.lextron = lextron;
    this.boundsContainer = boundsContainer || document.body;
    this.root = lextron.addContainer('lxt-tooltip');
    // @ts-expect-error
    this.root.innerHTML = this.constructor.TEMPLATE;
    if (isScrollable(this.lextron.root)) {
      this.lextron.root.addEventListener('scroll', () => {
        this.root.style.marginTop = `${-1 * this.lextron.root.scrollTop}px`;
      });
    }
    this.hide();
  }

  hide() {
    this.root.classList.add('lxt-hidden');
  }

  position(reference: Bounds) {
    const left =
      reference.left + reference.width / 2 - this.root.offsetWidth / 2;
    // root.scrollTop should be 0 if scrollContainer !== root
    const top = reference.bottom + this.lextron.root.scrollTop;
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
    this.root.classList.remove('lxt-flip');
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
      this.root.classList.add('lxt-flip');
    }
    return shift;
  }

  show() {
    this.root.classList.remove('lxt-editing');
    this.root.classList.remove('lxt-hidden');
  }
}

export default Tooltip;
