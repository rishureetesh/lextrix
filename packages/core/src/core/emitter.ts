/** Lextrix core — document editor shell. */
import { EventEmitter } from 'eventemitter3';
import instances from './instances.js';
import logger from './logger.js';

const debug = logger('lextrix:events');
const EVENTS = ['selectionchange', 'mousedown', 'mouseup', 'click'] as const;

type DocumentHandler = (...args: unknown[]) => void;

const documentHandlers = new Map<string, DocumentHandler>();
let documentListenerRefCount = 0;

function routeDocumentEvent(eventName: string, ...args: unknown[]) {
  Array.from(document.querySelectorAll('.lxr-container')).forEach((node) => {
    const lextrix = instances.get(node);
    if (lextrix && lextrix.emitter) {
      const [event, ...rest] = args;
      lextrix.emitter.handleDOM(event as Event, ...rest);
    }
  });
}

/** Install shared document listeners once (lazy; safe for SSR until first editor). */
export function retainDocumentListeners(): void {
  if (typeof document === 'undefined') return;
  documentListenerRefCount += 1;
  if (documentListenerRefCount > 1) return;

  for (const eventName of EVENTS) {
    const handler: DocumentHandler = (...args) =>
      routeDocumentEvent(eventName, ...args);
    documentHandlers.set(eventName, handler);
    document.addEventListener(eventName, handler as EventListener);
  }
}

/** Drop shared document listeners when the last editor is destroyed. */
export function releaseDocumentListeners(): void {
  if (typeof document === 'undefined') return;
  if (documentListenerRefCount === 0) return;
  documentListenerRefCount -= 1;
  if (documentListenerRefCount > 0) return;

  for (const eventName of EVENTS) {
    const handler = documentHandlers.get(eventName);
    if (handler) {
      document.removeEventListener(eventName, handler as EventListener);
    }
  }
  documentHandlers.clear();
}

/** Test helper — reset refcount without requiring a live document. */
export function resetDocumentListenerStateForTests(): void {
  if (typeof document !== 'undefined') {
    for (const eventName of EVENTS) {
      const handler = documentHandlers.get(eventName);
      if (handler) {
        document.removeEventListener(eventName, handler as EventListener);
      }
    }
  }
  documentHandlers.clear();
  documentListenerRefCount = 0;
}

class Emitter extends EventEmitter<string> {
  static events = {
    EDITOR_CHANGE: 'editor-change',
    SCROLL_BEFORE_UPDATE: 'scroll-before-update',
    SCROLL_BLOT_MOUNT: 'scroll-blot-mount',
    SCROLL_BLOT_UNMOUNT: 'scroll-blot-unmount',
    SCROLL_OPTIMIZE: 'scroll-optimize',
    SCROLL_UPDATE: 'scroll-update',
    SCROLL_EMBED_UPDATE: 'scroll-embed-update',
    SELECTION_CHANGE: 'selection-change',
    TEXT_CHANGE: 'text-change',
    COMPOSITION_BEFORE_START: 'composition-before-start',
    COMPOSITION_START: 'composition-start',
    COMPOSITION_BEFORE_END: 'composition-before-end',
    COMPOSITION_END: 'composition-end',
  } as const;

  static sources = {
    API: 'api',
    SILENT: 'silent',
    USER: 'user',
  } as const;

  protected domListeners: Record<string, { node: Node; handler: Function }[]>;

  constructor() {
    super();
    this.domListeners = {};
    this.on('error', debug.error);
  }

  emit(...args: unknown[]): boolean {
    debug.log.call(debug, ...args);
    // @ts-expect-error
    return super.emit(...args);
  }

  handleDOM(event: Event, ...args: unknown[]) {
    (this.domListeners[event.type] || []).forEach(({ node, handler }) => {
      if (event.target === node || node.contains(event.target as Node)) {
        handler(event, ...args);
      }
    });
  }

  listenDOM(eventName: string, node: Node, handler: EventListener) {
    if (!this.domListeners[eventName]) {
      this.domListeners[eventName] = [];
    }
    this.domListeners[eventName].push({ node, handler });
  }

  unlistenDOM(eventName: string, node: Node, handler: EventListener) {
    const list = this.domListeners[eventName];
    if (!list) return;
    this.domListeners[eventName] = list.filter(
      (entry) => !(entry.node === node && entry.handler === handler),
    );
  }

  clearDOMListeners() {
    this.domListeners = {};
  }
}

export type EmitterSource =
  (typeof Emitter.sources)[keyof typeof Emitter.sources];

export default Emitter;
