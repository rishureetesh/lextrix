import type ChangeSet from 'lextrix-change';

/** Supported built-in serialization formats. */
export type BuiltinSerializeFormat = 'html' | 'markdown' | 'mdx' | 'json';

/** Any registered serialization format identifier. */
export type SerializeFormat = BuiltinSerializeFormat | (string & {});

/** Options passed to export(). */
export interface ExportOptions {
  format: SerializeFormat;
  index?: number;
  length?: number;
}

/** Editor/runtime bridge used by format serializers that need live DOM access. */
export interface SerializerAdapter {
  getChangeSet(index?: number, length?: number): ChangeSet;
  setChangeSet(delta: ChangeSet): void;
  convertHtml?(html: string): ChangeSet;
  exportHtml?(index?: number, length?: number): string;
}

/** Context passed to every import/export call. */
export interface SerializerContext {
  adapter?: SerializerAdapter;
  /** Slice range for adapter-backed exporters (e.g. HTML). */
  exportRange?: { index: number; length: number };
  /** Extension data supplied by custom serializers or host configuration. */
  extensions?: Record<string, unknown>;
}

/** Contract for a bidirectional content serializer. */
export interface ContentSerializer {
  readonly format: SerializeFormat;
  /** Formats this serializer extends (e.g. mdx extends markdown). */
  readonly extends?: readonly SerializeFormat[];
  import(content: string, context?: SerializerContext): ChangeSet;
  export(changeSet: ChangeSet, context?: SerializerContext): string;
}

/** Factory that produces a configured serializer instance. */
export type SerializerFactory<TOptions extends object = object> = (
  options?: Partial<TOptions>,
) => ContentSerializer;

/** Future extension point for MDX/custom component nodes. */
export interface ComponentSerializerExtension {
  readonly nodeType: string;
  importNode?(
    raw: string,
    context?: SerializerContext,
  ): ChangeSet | null;
  exportNode?(changeSet: ChangeSet, context?: SerializerContext): string | null;
}
