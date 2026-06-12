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
  private imageLoadCleanup: (() => void) | null = null;
  private destroyed = false;

  constructor(lextrix: Lextrix, options: Partial<ImageResizeOptions>) {
    super(lextrix, options);
    this.lextrix.on(Lextrix.events.SELECTION_CHANGE, this.onSelectionChange);
    this.lextrix.on(Lextrix.events.SCROLL_OPTIMIZE, this.onScrollOptimize);
    this.lextrix.on(Lextrix.events.TEXT_CHANGE, this.onTextChange);
    this.lextrix.root.addEventListener('scroll', this.onRootScroll, {
      passive: true,
    });
  }

  onSelectionChange = (range: Range | null) => {
    if (this.destroyed) return;
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
  };

  private onScrollOptimize = () => {
    if (this.destroyed) return;
    this.reposition();
  };

  private onTextChange = () => {
    if (this.destroyed) return;
    this.reposition();
  };

  private onRootScroll = () => {
    if (this.destroyed) return;
    this.reposition();
  };

  show(blot: Blot, index: number) {
    this.clearImageLoadListener();
    this.activeBlot = blot;
    this.activeIndex = index;
    if (this.overlay == null) {
      this.createOverlay();
    }
    this.overlay!.classList.remove('lxr-hidden');
    this.watchImageLoad(blot);
    this.reposition();
  }

  hide() {
    this.clearImageLoadListener();
    this.activeBlot = null;
    this.activeIndex = null;
    this.overlay?.classList.add('lxr-hidden');
  }

  destroy() {
    this.destroyed = true;
    this.hide();
    this.lextrix.off(Lextrix.events.SELECTION_CHANGE, this.onSelectionChange);
    this.lextrix.off(Lextrix.events.SCROLL_OPTIMIZE, this.onScrollOptimize);
    this.lextrix.off(Lextrix.events.TEXT_CHANGE, this.onTextChange);
    this.lextrix.root.removeEventListener('scroll', this.onRootScroll);
    this.overlay?.remove();
    this.overlay = null;
    this.handle = null;
  }

  watchImageLoad(blot: Blot) {
    const img = blot.domNode;
    if (!(img instanceof HTMLImageElement) || img.complete) {
      return;
    }
    const onLoad = () => {
      if (this.destroyed) return;
      this.reposition();
    };
    img.addEventListener('load', onLoad, { once: true });
    this.imageLoadCleanup = () => {
      img.removeEventListener('load', onLoad);
    };
  }

  clearImageLoadListener() {
    this.imageLoadCleanup?.();
    this.imageLoadCleanup = null;
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'lxr-image-resize lxr-hidden';
    const handle = document.createElement('div');
    handle.className = 'lxr-image-resize-handle';
    handle.setAttribute('aria-label', 'Resize image');
    overlay.appendChild(handle);
    // Mount on container, not root — root is the scroll blot; foreign nodes break reconcile.
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

  reposition = () => {
    if (
      this.destroyed ||
      this.overlay == null ||
      this.activeIndex == null ||
      this.activeBlot == null
    ) {
      return;
    }
    const imageRect = (
      this.activeBlot.domNode as HTMLImageElement
    ).getBoundingClientRect();
    const containerRect = this.lextrix.container.getBoundingClientRect();
    if (this.overlay.parentElement !== this.lextrix.container) {
      this.lextrix.container.appendChild(this.overlay);
    }
    this.overlay.style.left = `${imageRect.left - containerRect.left}px`;
    this.overlay.style.top = `${imageRect.top - containerRect.top}px`;
    this.overlay.style.width = `${imageRect.width}px`;
    this.overlay.style.height = `${imageRect.height}px`;
  };
}

export default ImageResize;
