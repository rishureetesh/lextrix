/**
 * Public TypeScript declarations for the published `lextrix` npm package.
 * Hand-maintained — report gaps at https://github.com/rishureetesh/lextrix/issues
 */

export type EmitterSource = 'user' | 'api' | 'silent';

export type DebugLevel = 'error' | 'warn' | 'log' | 'info';

export type BuiltinSerializeFormat = 'html' | 'markdown' | 'mdx' | 'json';

export type SerializeFormat = BuiltinSerializeFormat | (string & {});

export interface ExportOptions {
  format: SerializeFormat;
  index?: number;
  length?: number;
}

export type ExportInput = SerializeFormat | ExportOptions;

export type ConversionSafety = 'safe' | 'lossy' | 'unsupported';

export interface SafetyIssue {
  feature: string;
  safety: ConversionSafety;
  message: string;
}

export interface Range {
  index: number;
  length: number;
}

export interface Bounds {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface ChangeAttributes {
  [key: string]: unknown;
}

export interface ChangeOp {
  insert?: string | Record<string, unknown>;
  delete?: number;
  retain?: number | Record<string, unknown>;
  attributes?: ChangeAttributes;
}

export declare class ChangeSet {
  ops: ChangeOp[];
  constructor(ops?: ChangeOp[] | { ops: ChangeOp[] });
  insert(
    value: string | Record<string, unknown>,
    attributes?: ChangeAttributes | null,
  ): ChangeSet;
  delete(length: number): ChangeSet;
  retain(
    length: number | Record<string, unknown>,
    attributes?: ChangeAttributes | null,
  ): ChangeSet;
  push(op: ChangeOp): ChangeSet;
  compose(other: ChangeSet): ChangeSet;
  concat(other: ChangeSet): ChangeSet;
  diff(other: ChangeSet): ChangeSet;
  invert(base: ChangeSet): ChangeSet;
  transform(other: ChangeSet, priority?: boolean): ChangeSet;
  transformPosition(index: number, priority?: boolean): number;
  length(): number;
  getText(index?: number, length?: number): string;
}

export interface LextrixOptions {
  theme?: string;
  debug?: DebugLevel | boolean;
  readOnly?: boolean;
  placeholder?: string;
  bounds?: HTMLElement | string | null;
  modules?: Record<string, unknown>;
  formats?: string[] | null;
  serializers?: boolean | unknown[];
}

export type TextChangeHandler = (
  delta: ChangeSet,
  oldDelta: ChangeSet,
  source: EmitterSource,
) => void;

export type SelectionChangeHandler = (
  range: Range,
  oldRange: Range,
  source: EmitterSource,
) => void;

export type EditorChangeHandler = (
  eventName: string,
  ...args: unknown[]
) => void;

export declare class Lextrix {
  static version: string;
  static events: {
    readonly EDITOR_CHANGE: 'editor-change';
    readonly SCROLL_BEFORE_UPDATE: 'scroll-before-update';
    readonly SCROLL_BLOT_MOUNT: 'scroll-blot-mount';
    readonly SCROLL_BLOT_UNMOUNT: 'scroll-blot-unmount';
    readonly SCROLL_OPTIMIZE: 'scroll-optimize';
    readonly SCROLL_UPDATE: 'scroll-update';
    readonly SCROLL_EMBED_UPDATE: 'scroll-embed-update';
    readonly SELECTION_CHANGE: 'selection-change';
    readonly TEXT_CHANGE: 'text-change';
    readonly COMPOSITION_BEFORE_START: 'composition-before-start';
    readonly COMPOSITION_START: 'composition-start';
    readonly COMPOSITION_BEFORE_END: 'composition-before-end';
    readonly COMPOSITION_END: 'composition-end';
  };
  static sources: {
    readonly API: 'api';
    readonly SILENT: 'silent';
    readonly USER: 'user';
  };
  static DEFAULTS: Partial<LextrixOptions>;
  static imports: Record<string, unknown>;

  container: HTMLElement;
  root: HTMLDivElement;
  scroll: unknown;
  emitter: unknown;
  editor: unknown;
  selection: unknown;
  history: {
    undo(): void;
    redo(): void;
    clear(): void;
    cutoff(): void;
  };
  clipboard: unknown;
  keyboard: unknown;
  uploader: unknown;

  constructor(container: string | HTMLElement, options?: LextrixOptions);

  static debug(limit: DebugLevel | boolean): void;
  static find(node: Node, bubble?: boolean): unknown;
  static import(name: string): unknown;
  static register(
    target: unknown,
    overwrite?: boolean,
  ): void;
  static register(
    path: string,
    target: unknown,
    overwrite?: boolean,
  ): void;

  destroy(): void;
  getExportWarnings(input: ExportInput): SafetyIssue[];
  importContent(
    content: string,
    format: SerializeFormat,
    source?: EmitterSource,
  ): ChangeSet;
  exportContent(input: ExportInput): string;
  listExportFormats(): SerializeFormat[];

  getContents(index?: number, length?: number): ChangeSet;
  setContents(delta: ChangeSet | ChangeOp[], source?: EmitterSource): ChangeSet;
  getText(index?: number, length?: number): string;
  getLength(): number;
  getSemanticHTML(index?: number, length?: number): string;
  getSemanticHTML(range: Range): string;

  insertText(
    index: number,
    text: string,
    source?: EmitterSource,
  ): ChangeSet;
  insertText(
    index: number,
    text: string,
    formats: ChangeAttributes,
    source?: EmitterSource,
  ): ChangeSet;
  insertEmbed(
    index: number,
    type: string,
    value: unknown,
    source?: EmitterSource,
  ): ChangeSet;
  deleteText(
    index: number,
    length: number,
    source?: EmitterSource,
  ): ChangeSet;
  deleteText(range: Range, source?: EmitterSource): ChangeSet;
  updateContents(delta: ChangeSet | ChangeOp[], source?: EmitterSource): ChangeSet;

  format(name: string, value: unknown, source?: EmitterSource): ChangeSet;
  formatText(
    index: number,
    length: number,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): ChangeSet;
  formatText(
    index: number,
    length: number,
    formats: ChangeAttributes,
    source?: EmitterSource,
  ): ChangeSet;
  formatLine(
    index: number,
    length: number,
    name: string,
    value: unknown,
    source?: EmitterSource,
  ): ChangeSet;
  formatLine(
    index: number,
    length: number,
    formats: ChangeAttributes,
    source?: EmitterSource,
  ): ChangeSet;
  getFormat(index?: number, length?: number): ChangeAttributes;
  getFormat(range: Range): ChangeAttributes;
  removeFormat(
    index: number,
    length: number,
    source?: EmitterSource,
  ): ChangeSet;

  getSelection(focus: true): Range;
  getSelection(focus?: boolean): Range | null;
  setSelection(
    index: number,
    length?: number | EmitterSource,
    source?: EmitterSource,
  ): void;
  setSelection(range: Range, source?: EmitterSource): void;
  getBounds(index: number, length?: number): Bounds | null;
  focus(): void;
  blur(): void;
  hasFocus(): boolean;

  on(event: 'text-change', handler: TextChangeHandler): void;
  on(event: 'selection-change', handler: SelectionChangeHandler): void;
  on(event: 'editor-change', handler: EditorChangeHandler): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  once(event: string, handler: (...args: unknown[]) => void): void;

  getModule(name: string): unknown;
  enable(enabled?: boolean): void;
  disable(): void;
  update(source?: EmitterSource): void;
}

export declare const lxrPath: {
  format(name: string): string;
  module(name: string): string;
  theme(name: string): string;
  attributor(kind: string, name: string): string;
  core: { module: string; theme: string };
};

export function registerSerializer(serializer: unknown): void;
export function unregisterSerializer(format: SerializeFormat): void;
export function registerMdxComponent(name: string, handler: unknown): void;
export function getMarkdownExportWarnings(delta: ChangeSet): SafetyIssue[];

export default Lextrix;
