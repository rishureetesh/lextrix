import { describe, expect, test, vi } from 'vitest';
import ChangeSet from 'lextrix-change';
import { htmlSerializer } from 'lextrix-serialize';

describe('html serializer', () => {
  test('import delegates to adapter.convertHtml', () => {
    const convertHtml = vi.fn(() => new ChangeSet([{ insert: 'Hi\n' }]));
    const delta = htmlSerializer().import('<p>Hi</p>', {
      adapter: { getChangeSet: () => new ChangeSet(), setChangeSet: () => {}, convertHtml },
    });
    expect(convertHtml).toHaveBeenCalledWith('<p>Hi</p>');
    expect(delta.ops).toEqual([{ insert: 'Hi\n' }]);
  });

  test('import throws without adapter', () => {
    expect(() => htmlSerializer().import('<p>x</p>')).toThrow(/convertHtml/);
  });

  test('export passes exportRange to adapter.exportHtml', () => {
    const exportHtml = vi.fn(() => '<p>slice</p>');
    const html = htmlSerializer().export(new ChangeSet(), {
      adapter: {
        getChangeSet: () => new ChangeSet(),
        setChangeSet: () => {},
        exportHtml,
      },
      exportRange: { index: 2, length: 5 },
    });
    expect(exportHtml).toHaveBeenCalledWith(2, 5);
    expect(html).toBe('<p>slice</p>');
  });

  test('export without range calls exportHtml with no args', () => {
    const exportHtml = vi.fn(() => '<p>full</p>');
    htmlSerializer().export(new ChangeSet(), {
      adapter: {
        getChangeSet: () => new ChangeSet(),
        setChangeSet: () => {},
        exportHtml,
      },
    });
    expect(exportHtml).toHaveBeenCalledWith();
  });

  test('export throws without adapter', () => {
    expect(() => htmlSerializer().export(new ChangeSet())).toThrow(/exportHtml/);
  });
});
