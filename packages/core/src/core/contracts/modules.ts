/**
 * Module contracts owned by core (Dependency Inversion).
 * Concrete implementations live in lextrix-modules; core only depends on these shapes.
 */
import type ChangeSet from 'lextrix-change';
import type { EmitterSource } from '../emitter.js';
import type { Range } from '../selection.js';

/** Minimal keyboard surface used by core and peer modules. */
export interface KeyboardModule {
  // Concrete Keyboard.addBinding is heavily overloaded; keep the contract open.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addBinding(...args: any[]): void;
}

/** Clipboard convert/paste surface used by the editor facade. */
export interface ClipboardModule {
  convert(
    content: { html?: string; text?: string },
    formats?: Record<string, unknown>,
  ): ChangeSet;
  dangerouslyPasteHTML(html: string, source?: EmitterSource): void;
  dangerouslyPasteHTML(
    index: number,
    html: string,
    source?: EmitterSource,
  ): void;
}

/** History stack surface used by the editor facade. */
export interface HistoryModule {
  clear(): void;
  cutoff(): void;
  undo(): void;
  redo(): void;
}

/** File drop/upload surface used by the editor facade. */
export interface UploaderModule {
  upload(range: Range, files: FileList | File[]): void;
}

/** Toolbar option shape without importing the toolbar module class. */
export type ToolbarConfig = Array<
  string[] | Array<string | Record<string, unknown>>
>;

export interface ToolbarOptions {
  container?: HTMLElement | ToolbarConfig | null;
  handlers?: Record<string, (this: unknown, value: unknown) => void>;
  option?: number;
  module?: boolean;
  theme?: boolean;
}

/** Runtime capability probe for optional browser dependencies. */
export interface EditorCapabilities {
  katex: boolean;
  highlightJs: boolean;
  imageResize: boolean;
  serializers: string[];
}
