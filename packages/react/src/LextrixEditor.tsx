'use client';

import Lextrix from 'lextrix';
import type { SelectionChangeHandler, TextChangeHandler } from 'lextrix';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type {
  LextrixContentFormat,
  LextrixEditorHandle,
  LextrixEditorProps,
} from './types.js';

function resolveFormat(format?: LextrixContentFormat): LextrixContentFormat {
  return format ?? 'html';
}

/**
 * React wrapper around {@link Lextrix}. Mounts an inner element, calls `destroy()` on unmount,
 * and supports controlled / uncontrolled content via `format` (html, markdown, mdx, json).
 *
 * Requires peer dependencies: `lextrix`, `react`, `react-dom`.
 * Import a theme stylesheet in your app, e.g. `import 'lextrix/snow.css'`.
 */
export const LextrixEditor = forwardRef<LextrixEditorHandle, LextrixEditorProps>(
  function LextrixEditor(props, ref) {
    const {
      theme = 'snow',
      options,
      value,
      defaultValue,
      format: formatProp,
      onChange,
      onSelectionChange,
      onReady,
      className,
      style,
    } = props;

    const format = resolveFormat(formatProp);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Lextrix | null>(null);
    const lastEmittedRef = useRef<string | undefined>(value ?? defaultValue);
    const isControlled = value !== undefined;

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const mount = document.createElement('div');
      wrapper.appendChild(mount);

      const editor = new Lextrix(mount, {
        ...options,
        theme,
      });
      editorRef.current = editor;

      const initial = value ?? defaultValue;
      if (initial != null && initial !== '') {
        editor.importContent(initial, format);
        lastEmittedRef.current = initial;
      }

      const handleTextChange: TextChangeHandler = (_delta, _oldDelta, source) => {
        const content = editor.exportContent(format);
        lastEmittedRef.current = content;
        onChangeRef.current?.(content, source);
      };

      const handleSelectionChange: SelectionChangeHandler = (
        range,
        oldRange,
        source,
      ) => {
        onSelectionChangeRef.current?.(range, oldRange, source);
      };

      editor.on('text-change', handleTextChange as (...args: unknown[]) => void);
      if (onSelectionChangeRef.current) {
        editor.on(
          'selection-change',
          handleSelectionChange as (...args: unknown[]) => void,
        );
      }

      onReadyRef.current?.(editor);

      return () => {
        editor.off(
          'text-change',
          handleTextChange as (...args: unknown[]) => void,
        );
        if (onSelectionChangeRef.current) {
          editor.off(
            'selection-change',
            handleSelectionChange as (...args: unknown[]) => void,
          );
        }
        editor.destroy();
        editorRef.current = null;
        wrapper.replaceChildren();
      };
      // `options` intentionally omitted — remount via `theme` or parent `key`.
    }, [theme]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || !isControlled || value === undefined) return;
      if (value === lastEmittedRef.current) return;
      editor.importContent(value, format);
      lastEmittedRef.current = value;
    }, [value, format, isControlled]);

    useImperativeHandle(
      ref,
      () => ({
        getEditor: () => editorRef.current,
        focus: (focusOptions) => editorRef.current?.focus(focusOptions),
        blur: () => editorRef.current?.blur(),
        exportContent: (exportFormat = format) =>
          editorRef.current?.exportContent(exportFormat) ?? '',
        importContent: (content, importFormat = format, source) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.importContent(content, importFormat, source);
          lastEmittedRef.current = content;
        },
      }),
      [format],
    );

    return (
      <div ref={wrapperRef} className={className} style={style} />
    );
  },
);

LextrixEditor.displayName = 'LextrixEditor';

export default LextrixEditor;
