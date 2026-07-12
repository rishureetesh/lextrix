import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LextrixEditor } from '../src/LextrixEditor.js';
import type { LextrixEditorHandle } from '../src/types.js';

type MockEditor = {
  destroy: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  importContent: ReturnType<typeof vi.fn>;
  exportContent: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  blur: ReturnType<typeof vi.fn>;
  mount: HTMLElement;
  options: unknown;
};

const { instances, MockLextrix } = vi.hoisted(() => {
  const instances: MockEditor[] = [];

  class MockLextrix {
    destroy = vi.fn();
    on = vi.fn();
    off = vi.fn();
    importContent = vi.fn();
    exportContent = vi.fn(() => 'exported');
    focus = vi.fn();
    blur = vi.fn();
    mount: HTMLElement;
    options: unknown;

    constructor(mount: HTMLElement, options?: unknown) {
      this.mount = mount;
      this.options = options;
      instances.push(this);
    }
  }

  return { instances, MockLextrix };
});

vi.mock('lextrix', () => ({
  default: MockLextrix,
}));

function latestEditor() {
  return instances[instances.length - 1];
}

function getHandler(editor: MockEditor, event: string) {
  return editor.on.mock.calls.find(([name]) => name === event)?.[1] as
    | ((...args: unknown[]) => void)
    | undefined;
}

afterEach(() => {
  cleanup();
  instances.length = 0;
});

describe('LextrixEditor', () => {
  it('creates an editor on a child of the wrapper', async () => {
    const { container } = render(<LextrixEditor theme="snow" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    const wrapper = container.firstElementChild as HTMLDivElement;
    expect(wrapper.childElementCount).toBe(1);
    expect(instances[0].mount.parentElement).toBe(wrapper);
  });

  it('passes theme and options to Lextrix constructor', async () => {
    render(
      <LextrixEditor
        theme="bubble"
        options={{ placeholder: 'Type here', readOnly: true }}
      />,
    );
    await waitFor(() => expect(instances).toHaveLength(1));
    expect(instances[0].options).toEqual({
      placeholder: 'Type here',
      readOnly: true,
      theme: 'bubble',
    });
  });

  it('applies className and style on the wrapper', async () => {
    const { container } = render(
      <LextrixEditor className="editor-wrap" style={{ minHeight: 200 }} />,
    );
    await waitFor(() => expect(instances).toHaveLength(1));
    const wrapper = container.firstElementChild as HTMLDivElement;
    expect(wrapper.className).toBe('editor-wrap');
    expect(wrapper.style.minHeight).toBe('200px');
  });

  it('calls destroy and removes listeners on unmount', async () => {
    const onSelectionChange = vi.fn();
    const { unmount } = render(
      <LextrixEditor onSelectionChange={onSelectionChange} />,
    );
    await waitFor(() => expect(instances).toHaveLength(1));
    const editor = instances[0];
    const textHandler = getHandler(editor, 'text-change');
    const selectionHandler = getHandler(editor, 'selection-change');
    unmount();
    expect(editor.off).toHaveBeenCalledWith('text-change', textHandler);
    expect(editor.off).toHaveBeenCalledWith(
      'selection-change',
      selectionHandler,
    );
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it('remounts when theme changes', async () => {
    const { rerender } = render(<LextrixEditor theme="snow" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    const first = instances[0];
    rerender(<LextrixEditor theme="bubble" />);
    await waitFor(() => expect(instances).toHaveLength(2));
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1].options).toMatchObject({ theme: 'bubble' });
  });

  it('survives React StrictMode double mount', async () => {
    render(
      <StrictMode>
        <LextrixEditor />
      </StrictMode>,
    );
    await waitFor(() => expect(instances.length).toBeGreaterThanOrEqual(1));
    expect(instances[0].destroy).toHaveBeenCalled();
    expect(latestEditor().destroy).not.toHaveBeenCalled();
  });

  it('calls onReady with the editor instance', async () => {
    const onReady = vi.fn();
    render(<LextrixEditor onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(onReady).toHaveBeenCalledWith(latestEditor());
  });

  it('imports defaultValue on mount', async () => {
    render(
      <LextrixEditor defaultValue="# Hello" format="markdown" theme="snow" />,
    );
    await waitFor(() => expect(instances).toHaveLength(1));
    expect(instances[0].importContent).toHaveBeenCalledWith(
      '# Hello',
      'markdown',
    );
  });

  it('imports controlled value on mount', async () => {
    render(<LextrixEditor value="<p>Hi</p>" format="html" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    expect(instances[0].importContent).toHaveBeenCalledWith('<p>Hi</p>', 'html');
  });

  it('skips import when initial content is empty', async () => {
    render(<LextrixEditor defaultValue="" format="html" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    expect(instances[0].importContent).not.toHaveBeenCalled();
  });

  it('forwards text-change to onChange with format', async () => {
    const onChange = vi.fn();
    render(<LextrixEditor onChange={onChange} format="markdown" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    const handler = getHandler(latestEditor(), 'text-change');
    handler?.(null, null, 'user');
    expect(latestEditor().exportContent).toHaveBeenCalledWith('markdown');
    expect(onChange).toHaveBeenCalledWith('exported', 'user');
  });

  it('forwards selection-change when handler is provided', async () => {
    const onSelectionChange = vi.fn();
    render(<LextrixEditor onSelectionChange={onSelectionChange} />);
    await waitFor(() => expect(instances).toHaveLength(1));
    const handler = getHandler(latestEditor(), 'selection-change');
    const range = { index: 0, length: 1 };
    handler?.(range, null, 'api');
    expect(onSelectionChange).toHaveBeenCalledWith(range, null, 'api');
  });

  it('does not register selection-change without a handler', async () => {
    render(<LextrixEditor />);
    await waitFor(() => expect(instances).toHaveLength(1));
    expect(
      latestEditor().on.mock.calls.some(([event]) => event === 'selection-change'),
    ).toBe(false);
  });

  it('syncs controlled value when prop changes externally', async () => {
    const { rerender } = render(
      <LextrixEditor value="# One" format="markdown" onChange={() => {}} />,
    );
    await waitFor(() => expect(instances).toHaveLength(1));
    const editor = instances[0];
    editor.importContent.mockClear();
    rerender(
      <LextrixEditor value="# Two" format="markdown" onChange={() => {}} />,
    );
    await waitFor(() =>
      expect(editor.importContent).toHaveBeenCalledWith('# Two', 'markdown'),
    );
  });

  it('does not re-import when controlled value matches last emission', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LextrixEditor value="same" format="html" onChange={onChange} />,
    );
    await waitFor(() => expect(instances).toHaveLength(1));
    const editor = instances[0];
    editor.importContent.mockClear();
    getHandler(editor, 'text-change')?.(null, null, 'user');
    expect(onChange).toHaveBeenCalledWith('exported', 'user');
    rerender(
      <LextrixEditor value="exported" format="html" onChange={onChange} />,
    );
    expect(editor.importContent).not.toHaveBeenCalled();
  });

  it('exposes imperative handle methods', async () => {
    const ref = createRef<LextrixEditorHandle>();
    render(<LextrixEditor ref={ref} format="json" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    const editor = instances[0];
    expect(ref.current?.getEditor()).toBe(editor);
    ref.current?.focus({ preventScroll: true });
    expect(editor.focus).toHaveBeenCalledWith({ preventScroll: true });
    ref.current?.blur();
    expect(editor.blur).toHaveBeenCalled();
    ref.current?.exportContent();
    expect(editor.exportContent).toHaveBeenCalledWith('json');
    ref.current?.importContent('{}', 'json', 'api');
    expect(editor.importContent).toHaveBeenCalledWith('{}', 'json', 'api');
  });

  it('defaults format to html for exportContent', async () => {
    const ref = createRef<LextrixEditorHandle>();
    render(<LextrixEditor ref={ref} />);
    await waitFor(() => expect(instances).toHaveLength(1));
    ref.current?.exportContent();
    expect(latestEditor().exportContent).toHaveBeenCalledWith('html');
  });
});
