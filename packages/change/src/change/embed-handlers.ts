import type ChangeOp from './change-op.js';

export interface EmbedHandler<T = unknown> {
  compose(a: T, b: T, keepNull: boolean): T;
  invert(a: T, b: T): T;
  transform(a: T, b: T, priority: boolean): T;
}

const handlers: Record<string, EmbedHandler> = {};

export function registerEmbedHandler<T>(
  embedType: string,
  handler: EmbedHandler<T>,
): void {
  handlers[embedType] = handler as EmbedHandler;
}

export function unregisterEmbedHandler(embedType: string): void {
  delete handlers[embedType];
}

export function getEmbedHandler(embedType: string): EmbedHandler {
  const handler = handlers[embedType];
  if (!handler) {
    throw new Error(`no handlers for embed type "${embedType}"`);
  }
  return handler;
}

export const getEmbedTypeAndData = (
  a: ChangeOp['insert'] | ChangeOp['retain'],
  b: ChangeOp['insert'],
): [string, unknown, unknown] => {
  if (typeof a !== 'object' || a === null) {
    throw new Error(`cannot retain a ${typeof a}`);
  }
  if (typeof b !== 'object' || b === null) {
    throw new Error(`cannot retain a ${typeof b}`);
  }
  const embedType = Object.keys(a)[0];
  if (!embedType || embedType !== Object.keys(b)[0]) {
    throw new Error(
      `embed types not matched: ${embedType} != ${Object.keys(b)[0]}`,
    );
  }
  return [embedType, a[embedType], b[embedType]];
};
