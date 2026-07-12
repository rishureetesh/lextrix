import type {
  EmitterSource,
  LextrixOptions,
  Range,
  SerializeFormat,
} from 'lextrix';
import type Lextrix from 'lextrix';

/** Serialization format for `value` / `defaultValue` / `onChange`. */
export type LextrixContentFormat = SerializeFormat;

export interface LextrixEditorProps {
  /**
   * Lextrix theme name (`snow`, `bubble`, `slate`, `dawn`).
   * Changing `theme` remounts the editor.
   */
  theme?: string;
  /**
   * Editor options passed to `new Lextrix()`.
   * Applied on mount only — use `key={...}` to re-initialize when options change.
   */
  options?: Omit<LextrixOptions, 'theme'>;
  /** Controlled document string in `format`. */
  value?: string;
  /** Initial document when uncontrolled. */
  defaultValue?: string;
  /** Serialization format for `value`, `defaultValue`, and `onChange`. Default `html`. */
  format?: LextrixContentFormat;
  /** Fired after user edits when content is exported in `format`. */
  onChange?: (content: string, source: EmitterSource) => void;
  /** Passed through from Lextrix `selection-change`. */
  onSelectionChange?: (
    range: Range,
    oldRange: Range,
    source: EmitterSource,
  ) => void;
  /** Called once after the editor instance is created. */
  onReady?: (editor: Lextrix) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface LextrixEditorHandle {
  /** Underlying Lextrix instance, or `null` before mount / after unmount. */
  getEditor(): Lextrix | null;
  focus(options?: { preventScroll?: boolean }): void;
  blur(): void;
  exportContent(format?: LextrixContentFormat): string;
  importContent(
    content: string,
    format?: LextrixContentFormat,
    source?: EmitterSource,
  ): void;
}

export type { Lextrix, LextrixOptions, Range, SerializeFormat };
