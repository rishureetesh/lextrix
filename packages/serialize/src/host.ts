import type ChangeSet from 'lextrix-change';
import type {
  ExportOptions,
  SerializerAdapter,
  SerializerContext,
  SerializeFormat,
} from './types.js';
import { SerializerRegistry } from './registry.js';

export type ExportInput = SerializeFormat | ExportOptions;

/** Host that wires serializers to a live editor adapter. */
export class SerializerHost {
  private adapter: SerializerAdapter | undefined;

  constructor(
    private readonly registry: SerializerRegistry,
    adapter?: SerializerAdapter,
  ) {
    this.adapter = adapter;
  }

  setAdapter(adapter: SerializerAdapter): void {
    this.adapter = adapter;
  }

  getRegistry(): SerializerRegistry {
    return this.registry;
  }

  listFormats(): SerializeFormat[] {
    return this.registry.list();
  }

  import(content: string, format: SerializeFormat): ChangeSet {
    const serializer = this.registry.resolve(format);
    return serializer.import(content, this.createContext());
  }

  export(input: ExportInput): string {
    const options = normalizeExportInput(input);
    const serializer = this.registry.resolve(options.format);
    const adapter = this.adapter;

    if (!adapter) {
      throw new Error(
        'Cannot export: no editor adapter bound. ' +
          'Pure ChangeSet export requires a bound editor or headless context.',
      );
    }

    const index = options.index ?? 0;
    const length =
      options.length ?? Math.max(0, adapter.getChangeSet().length() - index);
    const changeSet = adapter.getChangeSet(index, length);
    return serializer.export(
      changeSet,
      this.createContext({ index, length }),
    );
  }

  /** Headless import — returns ChangeSet without applying to editor. */
  parse(content: string, format: SerializeFormat): ChangeSet {
    const serializer = this.registry.resolve(format);
    return serializer.import(content, this.createContext());
  }

  /** Headless export — converts a ChangeSet to the target format. */
  stringify(changeSet: ChangeSet, format: SerializeFormat): string {
    const serializer = this.registry.resolve(format);
    return serializer.export(changeSet, this.createContext());
  }

  private createContext(
    exportRange?: { index: number; length: number },
  ): SerializerContext {
    const context: SerializerContext = { adapter: this.adapter };
    if (exportRange) {
      context.exportRange = exportRange;
    }
    return context;
  }
}

function normalizeExportInput(input: ExportInput): ExportOptions {
  if (typeof input === 'string') {
    return { format: input };
  }
  return input;
}
