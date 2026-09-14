import type { LextrixPlugin } from './plugins/plugin-host.js';

/**
 * Base class for editor plugins.
 * Subclasses should register cleanup via {@link track} / {@link listen} / {@link onEditor}
 * so {@link destroy} can release resources without facade special-cases.
 */
abstract class Module<T extends object = object> implements LextrixPlugin<T> {
  static DEFAULTS = {};

  readonly lextrix;
  readonly options: Partial<T>;

  private readonly disposers: Array<() => void> = [];
  private disposed = false;

  constructor(lextrix: import('./lextrix.js').default, options: Partial<T> = {}) {
    this.lextrix = lextrix;
    this.options = options;
  }

  get id(): string {
    return this.constructor.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /** True after {@link destroy} — subclasses may guard async handlers. */
  protected get isDisposed(): boolean {
    return this.disposed;
  }

  bindEditor(_editor: import('./lextrix.js').default): void {
    // Modules self-register in constructors; bindEditor reserved for explicit lifecycle.
  }

  unbindEditor(_editor: import('./lextrix.js').default): void {
    this.destroy();
  }

  /** Register an arbitrary cleanup callback (LIFO on destroy). */
  protected track(dispose: () => void): void {
    this.disposers.push(dispose);
  }

  /** AddEventListener with automatic removal on destroy. */
  protected listenDom(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.track(() => target.removeEventListener(type, listener, options));
  }

  /** Lextrix emitter subscription with automatic off() on destroy. */
  protected onEditor(
    event: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...args: any[]) => void,
  ): void {
    this.lextrix.on(event, handler);
    this.track(() => this.lextrix.off(event, handler));
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    while (this.disposers.length > 0) {
      const dispose = this.disposers.pop();
      try {
        dispose?.();
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}

export default Module;
