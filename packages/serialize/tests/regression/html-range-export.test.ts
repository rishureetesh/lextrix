import { describe, expect, test, vi } from 'vitest';
import ChangeSet from 'lextrix-change';
import { SerializerHost, createSerializerRegistry, htmlSerializer } from 'lextrix-serialize';

/**
 * Regression: HTML export must respect export range, not always export full document.
 * @see packages/serialize/src/html/html-serializer.ts
 */
describe('regression: html range export', () => {
  test('SerializerHost.export passes range to HTML adapter', () => {
    const exportHtml = vi.fn((_index?: number, _length?: number) => '<p>partial</p>');
    const getChangeSet = vi.fn((index = 0, length?: number) => {
      const resolved = length ?? 10 - index;
      return new ChangeSet([{ insert: 'x'.repeat(resolved) }]);
    });

    const host = new SerializerHost(
      createSerializerRegistry([htmlSerializer()]),
      {
        getChangeSet,
        setChangeSet: () => {},
        exportHtml,
      },
    );

    host.export({ format: 'html', index: 2, length: 4 });

    expect(getChangeSet).toHaveBeenCalledWith(2, 4);
    expect(exportHtml).toHaveBeenCalledWith(2, 4);
  });
});
