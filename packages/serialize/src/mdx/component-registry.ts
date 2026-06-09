import ChangeSet from 'lextrix-change';
import type { SerializerContext } from '../types.js';

/** Parsed MDX component node — extension point for custom component handlers. */
export interface MdxComponentNode {
  tag: string;
  props: Record<string, string>;
  children: string;
  selfClosing: boolean;
  raw: string;
}

/** Handler for a custom MDX component ↔ ChangeSet mapping. */
export interface MdxComponentHandler {
  readonly tag: string;
  toChangeSet?(
    node: MdxComponentNode,
    context?: SerializerContext,
  ): ChangeSet | null;
  fromChangeSet?(
    block: {
      tag: string;
      content: unknown;
      attributes: Record<string, unknown>;
    },
    context?: SerializerContext,
  ): string | null;
}

/** Registry for MDX component serializers (future `<Alert>`, `<MyComponent />`, etc.). */
export class MdxComponentRegistry {
  private readonly handlers = new Map<string, MdxComponentHandler>();

  register(handler: MdxComponentHandler): this {
    this.handlers.set(handler.tag.toLowerCase(), handler);
    return this;
  }

  unregister(tag: string): boolean {
    return this.handlers.delete(tag.toLowerCase());
  }

  get(tag: string): MdxComponentHandler | undefined {
    return this.handlers.get(tag.toLowerCase());
  }

  has(tag: string): boolean {
    return this.handlers.has(tag.toLowerCase());
  }

  list(): string[] {
    return [...this.handlers.keys()];
  }
}

const globalMdxRegistry = new MdxComponentRegistry();

export function getGlobalMdxComponentRegistry(): MdxComponentRegistry {
  return globalMdxRegistry;
}

export function registerMdxComponent(handler: MdxComponentHandler): void {
  globalMdxRegistry.register(handler);
}
