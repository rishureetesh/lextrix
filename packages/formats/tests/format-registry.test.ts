import { describe, expect, it } from 'vitest';
import {
  FormatDefinitionCatalog,
  getAttributorFormat,
  getFormatGroup,
} from '../src/format-definition.js';
import '../src/formats/list.js';
import '../src/formats/table.js';
import '../src/formats/code.js';
import '../src/formats/link.js';
import '../src/formats/align.js';
import '../src/formats/color.js';
import '../src/formats/indent.js';
import '../src/formats/blockquote.js';
import '../src/formats/script.js';

describe('format definition registry', () => {
  it('registers list format group', () => {
    const group = getFormatGroup('list');
    expect(group?.blotNames).toEqual(['list', 'list-container']);
  });

  it('registers table format group', () => {
    const group = getFormatGroup('table');
    expect(group?.blotNames).toEqual([
      'table',
      'table-row',
      'table-body',
      'table-container',
    ]);
  });

  it('registers code-block format group', () => {
    const group = getFormatGroup('code-block');
    expect(group?.blotNames).toEqual(['code', 'code-block', 'code-block-container']);
  });

  it('registers link format group', () => {
    const group = getFormatGroup('link');
    expect(group?.blotNames).toEqual(['link']);
  });

  it('includes migrated formats in catalog', () => {
    const names = new Set(FormatDefinitionCatalog.list().map((d) => d.name));
    expect(names.has('list')).toBe(true);
    expect(names.has('table-row')).toBe(true);
    expect(names.has('code-block')).toBe(true);
    expect(names.has('link')).toBe(true);
    expect(names.has('blockquote')).toBe(true);
    expect(names.has('script')).toBe(true);
  });

  it('registers attributor format groups', () => {
    expect(getFormatGroup('align')?.attributorNames).toEqual([
      'lxr-align',
      'text-align',
    ]);
    expect(getFormatGroup('color')?.attributorNames).toEqual(['lxr-color', 'color']);
    expect(getFormatGroup('indent')?.attributorNames).toEqual(['lxr-indent']);
  });

  it('resolves attributors from catalog without registry', () => {
    const color = FormatDefinitionCatalog.resolveAttributor('color');
    expect(color?.keyName).toBe('color');
    expect(FormatDefinitionCatalog.resolveAttributor('lxr-indent')).toBeDefined();
    expect(FormatDefinitionCatalog.listAttributors().length).toBeGreaterThan(5);
  });
});
