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
  private resizeObserver: ResizeObserver | null = null;
  private repositionRaf: number | null = null;
  private dragCleanup: (() => void) | null = null;

  constructor(lextrix: Lextrix, options: Partial<ImageResizeOptions>) {
    super(lextrix, options);
    this.onEditor(Lextrix.events.SELECTION_CHANGE, this.onSelectionChange);
    this.onEditor(Lextrix.events.SCROLL_OPTIMIZE, this.onScrollOptimize);
    this.onEditor(Lextrix.events.TEXT_CHANGE, this.onTextChange);
    this.listenDom(this.lextrix.root, 'scroll', this.onRootScroll, {
      passive: true,
    });
    this.listenDom(document, 'scroll', this.onLayoutChange, {
      passive: true,
      capture: true,
    });
    this.listenDom(window, 'resize', this.onLayoutChange, { passive: true });
  }

  onSelectionChange = (range: Range | null) => {
    if (this.isDisposed) return;
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
    if (this.isDisposed) return;
    this.scheduleReposition();
  };

  private onTextChange = () => {
    if (this.isDisposed) return;
    this.scheduleReposition();
  };

  private onRootScroll = () => {
    if (this.isDisposed) return;
    this.scheduleReposition();
  };

  private onLayoutChange = () => {
    if (this.isDisposed) return;
    this.scheduleReposition();
  };

  show(blot: Blot, index: number) {
    this.clearImageLoadListener();
    this.clearResizeObserver();
    this.activeBlot = blot;
    this.activeIndex = index;
    if (this.overlay == null) {
      this.createOverlay();
    }
    this.overlay!.classList.remove('lxr-hidden');
    this.watchImageLoad(blot);
    this.watchLayout(blot);
    // Defer until after layout settles (selection + nested scroll/transform).
    this.scheduleReposition();
  }

  hide() {
    this.clearImageLoadListener();
    this.clearResizeObserver();
    this.clearDragListeners();
    this.cancelScheduledReposition();
    this.activeBlot = null;
    this.activeIndex = null;
    this.overlay?.classList.add('lxr-hidden');
  }

  destroy() {
    this.hide();
    this.overlay?.remove();
    this.overlay = null;
    this.handle = null;
    super.destroy();
  }

  watchImageLoad(blot: Blot) {
    const img = blot.domNode;
    if (!(img instanceof HTMLImageElement) || img.complete) {
      return;
    }
    const onLoad = () => {
      if (this.isDisposed) return;
      this.scheduleReposition();
    };
    img.addEventListener('load', onLoad, { once: true });
    this.imageLoadCleanup = () => {
      img.removeEventListener('load', onLoad);
    };
  }

  watchLayout(blot: Blot) {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const img = blot.domNode;
    if (!(img instanceof HTMLImageElement)) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isDisposed) return;
      this.scheduleReposition();
    });
    this.resizeObserver.observe(img);
    this.resizeObserver.observe(this.lextrix.container);
  }

  clearImageLoadListener() {
    this.imageLoadCleanup?.();
    this.imageLoadCleanup = null;
  }

  clearResizeObserver() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  clearDragListeners() {
    this.dragCleanup?.();
    this.dragCleanup = null;
  }

  cancelScheduledReposition() {
    if (this.repositionRaf != null) {
      cancelAnimationFrame(this.repositionRaf);
      this.repositionRaf = null;
    }
  }

  scheduleReposition() {
    if (
      this.isDisposed ||
      this.overlay == null ||
      this.activeIndex == null ||
      this.activeBlot == null
    ) {
      return;
    }
    this.cancelScheduledReposition();
    this.repositionRaf = requestAnimationFrame(() => {
      this.repositionRaf = requestAnimationFrame(() => {
        this.repositionRaf = null;
        this.reposition();
      });
    });
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
    this.listenDom(handle, 'mousedown', (event) => {
      const mouseEvent = event as MouseEvent;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      if (this.activeBlot == null || this.isDisposed) return;

      const img = this.activeBlot.domNode as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      let startX = mouseEvent.clientX;
      let startWidth = rect.width;
      const aspect = rect.width / Math.max(rect.height, 1);

      const onMove = (moveEvent: MouseEvent) => {
        if (this.activeBlot == null || this.activeIndex == null || this.isDisposed) {
          return;
        }
        const delta = moveEvent.clientX - startX;
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
        this.clearDragListeners();
        if (this.activeBlot == null || this.activeIndex == null || this.isDisposed) {
          return;
        }
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
        this.scheduleReposition();
      };

      this.clearDragListeners();
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      this.dragCleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
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
      this.isDisposed ||
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
