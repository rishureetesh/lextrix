import type { Blot } from 'lextron-dom';
import Lextron from 'lextron-core';
import Emitter from 'lextron-core/core/emitter.js';
import Module from 'lextron-core/core/module.js';
import type { Range } from 'lextron-core/core/selection.js';

export interface ImageResizeOptions {
  minWidth: number;
  maxWidth: number | null;
}

class ImageResize extends Module<ImageResizeOptions> {
  static DEFAULTS: ImageResizeOptions = {
    minWidth: 48,
    maxWidth: null,
  };

  overlay: HTMLDivElement | null = null;
  handle: HTMLDivElement | null = null;
  activeIndex: number | null = null;
  activeBlot: Blot | null = null;

  constructor(lextron: Lextron, options: Partial<ImageResizeOptions>) {
    super(lextron, options);
    this.onSelectionChange = this.onSelectionChange.bind(this);
    this.reposition = this.reposition.bind(this);
    this.lextron.on(Lextron.events.SELECTION_CHANGE, this.onSelectionChange);
    this.lextron.on(Lextron.events.SCROLL_OPTIMIZE, this.reposition);
    this.lextron.on(Lextron.events.TEXT_CHANGE, this.reposition);
    this.lextron.root.addEventListener('scroll', this.reposition, {
      passive: true,
    });
  }

  onSelectionChange(range: Range | null) {
    if (
      range == null ||
      range.length !== 1 ||
      this.lextron.scroll.query('image') == null
    ) {
      this.hide();
      return;
    }
    const [blot] = this.lextron.scroll.descendant(
      (candidate: Blot) => candidate.statics.blotName === 'image',
      range.index,
    );
    if (blot == null) {
      this.hide();
      return;
    }
    this.show(blot, range.index);
  }

  show(blot: Blot, index: number) {
    this.activeBlot = blot;
    this.activeIndex = index;
    if (this.overlay == null) {
      this.createOverlay();
    }
    this.overlay!.classList.remove('lxt-hidden');
    this.reposition();
  }

  hide() {
    this.activeBlot = null;
    this.activeIndex = null;
    this.overlay?.classList.add('lxt-hidden');
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'lxt-image-resize lxt-hidden';
    const handle = document.createElement('div');
    handle.className = 'lxt-image-resize-handle';
    handle.setAttribute('aria-label', 'Resize image');
    overlay.appendChild(handle);
    this.lextron.container.appendChild(overlay);
    this.overlay = overlay;
    this.handle = handle;
    this.bindHandle(handle);
  }

  bindHandle(handle: HTMLDivElement) {
    let startX = 0;
    let startWidth = 0;
    let aspect = 1;

    const onMove = (event: MouseEvent) => {
      if (this.activeBlot == null || this.activeIndex == null) return;
      const img = this.activeBlot.domNode as HTMLImageElement;
      const delta = event.clientX - startX;
      const maxWidth = this.getMaxWidth();
      const minWidth = this.options.minWidth ?? ImageResize.DEFAULTS.minWidth;
      const nextWidth = Math.round(
        Math.max(minWidth, Math.min(maxWidth, startWidth + delta)),
      );
      img.style.width = `${nextWidth}px`;
      img.style.height = `${Math.round(nextWidth / aspect)}px`;
      this.reposition();
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (this.activeBlot == null || this.activeIndex == null) return;
      const img = this.activeBlot.domNode as HTMLImageElement;
      const width = Math.round(img.getBoundingClientRect().width);
      const height = Math.round(img.getBoundingClientRect().height);
      img.style.width = '';
      img.style.height = '';
      const imageBlot = this.activeBlot as Blot & {
        format(name: string, value: string): void;
      };
      imageBlot.format('width', String(width));
      imageBlot.format('height', String(height));
      this.lextron.update(Emitter.sources.USER);
      this.reposition();
    };

    handle.addEventListener('mousedown', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.activeBlot == null) return;
      const img = this.activeBlot.domNode as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      startX = event.clientX;
      startWidth = rect.width;
      aspect = rect.width / Math.max(rect.height, 1);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  getMaxWidth(): number {
    if (this.options.maxWidth != null) {
      return this.options.maxWidth;
    }
    return this.lextron.root.clientWidth || Number.MAX_SAFE_INTEGER;
  }

  reposition() {
    if (
      this.overlay == null ||
      this.activeIndex == null ||
      this.activeBlot == null
    ) {
      return;
    }
    const bounds = this.lextron.getBounds(this.activeIndex, 1);
    if (bounds == null) {
      this.hide();
      return;
    }
    const containerRect = this.lextron.container.getBoundingClientRect();
    this.overlay.style.left = `${bounds.left - containerRect.left}px`;
    this.overlay.style.top = `${bounds.top - containerRect.top}px`;
    this.overlay.style.width = `${bounds.width}px`;
    this.overlay.style.height = `${bounds.height}px`;
  }
}

export default ImageResize;
