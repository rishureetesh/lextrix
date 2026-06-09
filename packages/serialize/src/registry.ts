import type { ContentSerializer, SerializeFormat } from './types.js';

/** Registry for content serializers. Supports global and per-editor instances. */
export class SerializerRegistry {
  private readonly serializers = new Map<string, ContentSerializer>();

  register(serializer: ContentSerializer): this {
    this.serializers.set(serializer.format, serializer);
    return this;
  }

  unregister(format: SerializeFormat): boolean {
    return this.serializers.delete(format);
  }

  get(format: SerializeFormat): ContentSerializer | undefined {
    return this.serializers.get(format);
  }

  has(format: SerializeFormat): boolean {
    return this.serializers.has(format);
  }

  list(): SerializeFormat[] {
    return [...this.serializers.keys()];
  }

  entries(): Array<[SerializeFormat, ContentSerializer]> {
    return [...this.serializers.entries()];
  }

  resolve(format: SerializeFormat): ContentSerializer {
    const serializer = this.get(format);
    if (serializer) return serializer;

    for (const candidate of this.serializers.values()) {
      if (candidate.extends?.includes(format)) {
        return candidate;
      }
    }

    throw new Error(
      `No serializer registered for format "${format}". ` +
        `Available: ${this.list().join(', ') || '(none)'}`,
    );
  }

  /** Register serializers from another registry without overwriting existing formats. */
  mergeFrom(source: SerializerRegistry): this {
    source.entries().forEach(([format, serializer]) => {
      if (!this.has(format)) {
        this.register(serializer);
      }
    });
    return this;
  }
}

const globalRegistry = new SerializerRegistry();

/** Register a serializer globally (for third-party extensions). */
export function registerSerializer(serializer: ContentSerializer): void {
  globalRegistry.register(serializer);
}

/** Unregister a globally registered serializer. */
export function unregisterSerializer(format: SerializeFormat): boolean {
  return globalRegistry.unregister(format);
}

/** Get the global serializer registry. */
export function getGlobalSerializerRegistry(): SerializerRegistry {
  return globalRegistry;
}

/** Create a new isolated serializer registry. */
export function createSerializerRegistry(
  serializers: ContentSerializer[] = [],
): SerializerRegistry {
  const registry = new SerializerRegistry();
  serializers.forEach((s) => registry.register(s));
  return registry;
}
