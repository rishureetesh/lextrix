import { describe, expect, test } from 'vitest';
import { mdxSerializer } from 'lextrix-serialize';

/** Regression: multiple import/export lines must all be stripped. */
describe('regression: mdx preamble stripping', () => {
  test('strips multiple import and export lines', () => {
    const source = `import A from 'a';
import B from 'b';
export const meta = {};
export function Page() {}

# Title`;

    const delta = mdxSerializer().import(source);
    expect(delta.ops).toEqual([
      { insert: 'Title' },
      { insert: '\n', attributes: { header: 1 } },
    ]);
  });
});
