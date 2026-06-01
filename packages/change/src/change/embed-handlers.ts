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
