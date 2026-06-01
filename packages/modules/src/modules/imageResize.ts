import type { Blot } from 'lextrix-dom';
import Lextrix from 'lextrix-core';
import Emitter from 'lextrix-core/core/emitter.js';
import Module from 'lextrix-core/core/module.js';
import type { Range } from 'lextrix-core/core/selection.js';

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

  constructor(lextrix: Lextrix, options: Partial<ImageResizeOptions>) {
    super(lextrix, options);
    this.onSelectionChange = this.onSelectionChange.bind(this);
    this.reposition = this.reposition.bind(this);
    this.lextrix.on(Lextrix.events.SELECTION_CHANGE, this.onSelectionChange);
    this.lextrix.on(Lextrix.events.SCROLL_OPTIMIZE, this.reposition);
    this.lextrix.on(Lextrix.events.TEXT_CHANGE, this.reposition);
    this.lextrix.root.addEventListener('scroll', this.reposition, {
      passive: true,
    });
  }

  onSelectionChange(range: Range | null) {
    if (
      range == null ||
      range.length !== 1 ||
      this.lextrix.scroll.query('image') == null
    ) {
      this.hide();
      return;
    }
    const [blot] = this.lextrix.scroll.descendant(
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
    this.overlay!.classList.remove('lxr-hidden');
    this.reposition();
  }

  hide() {
    this.activeBlot = null;
    this.activeIndex = null;
    this.overlay?.classList.add('lxr-hidden');
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'lxr-image-resize lxr-hidden';
    const handle = document.createElement('div');
    handle.className = 'lxr-image-resize-handle';
    handle.setAttribute('aria-label', 'Resize image');
    overlay.appendChild(handle);
    this.lextrix.container.appendChild(overlay);
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
      this.lextrix.update(Emitter.sources.USER);
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
    return this.lextrix.root.clientWidth || Number.MAX_SAFE_INTEGER;
  }

  reposition() {
    if (
      this.overlay == null ||
      this.activeIndex == null ||
      this.activeBlot == null
    ) {
      return;
    }
    const bounds = this.lextrix.getBounds(this.activeIndex, 1);
    if (bounds == null) {
      this.hide();
      return;
    }
    const containerRect = this.lextrix.container.getBoundingClientRect();
    this.overlay.style.left = `${bounds.left - containerRect.left}px`;
    this.overlay.style.top = `${bounds.top - containerRect.top}px`;
    this.overlay.style.width = `${bounds.width}px`;
    this.overlay.style.height = `${bounds.height}px`;
  }
}

export default ImageResize;
