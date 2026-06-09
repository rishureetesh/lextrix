import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './fixtures/index.js';
import { SHORTKEY } from './utils/index.js';

const undo = (page: Page) => page.keyboard.press(`${SHORTKEY}+z`);
const redo = (page: Page) => page.keyboard.press(`${SHORTKEY}+Shift+z`);

test.describe('serialization', () => {
  test.beforeEach(async ({ editorPage }) => {
    await editorPage.open();
  });

  test.describe('typing', () => {
    test('typed content exports to markdown', async ({ page, editorPage }) => {
      await editorPage.root.click();
      await page.keyboard.type('Hello serialization');
      const md = await editorPage.exportContent('markdown');
      expect(md).toContain('Hello serialization');
    });
  });

  test.describe('HTML import', () => {
    test('imports HTML into editor', async ({ editorPage }) => {
      await editorPage.importContent(
        '<p>Hello <strong>world</strong></p>',
        'html',
      );
      const html = await editorPage.getSemanticHTML();
      expect(html).toContain('<strong>world</strong>');
      expect(await editorPage.getText()).toContain('Hello world');
    });
  });

  test.describe('HTML export', () => {
    test('exports editor content as HTML', async ({ editorPage }) => {
      await editorPage.setContents([
        { insert: 'Hello ' },
        { insert: 'world', attributes: { bold: true } },
        { insert: '\n' },
      ]);
      const html = await editorPage.exportContent('html');
      expect(html).toContain('<strong>world</strong>');
    });
  });

  test.describe('markdown import and export', () => {
    test('imports and exports markdown', async ({ editorPage }) => {
      await editorPage.importContent('# Title\n\n**bold** text', 'markdown');
      const md = await editorPage.exportContent('markdown');
      expect(md).toContain('# Title');
      expect(md).toContain('**bold**');
    });

    test('imports nested lists', async ({ editorPage }) => {
      await editorPage.importContent('- Parent\n  - Child', 'markdown');
      const md = await editorPage.exportContent('markdown');
      expect(md).toContain('- Parent');
      expect(md).toContain('  - Child');
    });
  });

  test.describe('MDX import and export', () => {
    test('preserves JSX components', async ({ editorPage }) => {
      await editorPage.importContent('# Hi\n\n<Alert>Warn</Alert>', 'mdx');
      const mdx = await editorPage.exportContent('mdx');
      expect(mdx).toContain('<Alert>Warn</Alert>');
    });
  });

  test.describe('clipboard', () => {
    test('copy HTML and paste preserves formatting', async ({
      editorPage,
      clipboard,
    }) => {
      await editorPage.setContents([
        { insert: 'Copy ' },
        { insert: 'me', attributes: { bold: true } },
        { insert: '\n' },
      ]);
      await editorPage.selectText('Copy', 'me');
      await clipboard.copy();
      await editorPage.setContents([{ insert: '\n' }]);
      await editorPage.root.click();
      await clipboard.paste();

      const html = await editorPage.getSemanticHTML();
      expect(html).toMatch(/<strong>.*me.*<\/strong>/);
    });

    test('paste HTML clipboard then export round-trip', async ({
      editorPage,
      clipboard,
    }) => {
      await clipboard.writeHTML('<p>Pasted <em>italic</em></p>');
      await editorPage.root.click();
      await clipboard.paste();

      const exported = await editorPage.exportContent('html');
      expect(exported).toContain('<em>italic</em>');

      await editorPage.importContent(exported, 'html');
      const again = await editorPage.exportContent('html');
      expect(again).toContain('italic');
    });

    test('paste rich text from HTML clipboard', async ({
      editorPage,
      clipboard,
    }) => {
      await clipboard.writeHTML(
        '<p>Rich <strong>bold</strong> and <em>italic</em></p>',
      );
      await editorPage.root.click();
      await clipboard.paste();

      const html = await editorPage.getSemanticHTML();
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });
  });

  test.describe('selection and formatting', () => {
    test('exports selected range as HTML slice', async ({ editorPage }) => {
      await editorPage.setContents([
        { insert: 'One' },
        { insert: '\n' },
        { insert: 'Two' },
        { insert: '\n' },
        { insert: 'Three' },
        { insert: '\n' },
      ]);
      const full = await editorPage.exportContent('html');
      const slice = await editorPage.exportContent('html', {
        index: 4,
        length: 3,
      });
      expect(slice.length).toBeLessThan(full.length);
      expect(slice).toContain('Two');
      expect(slice).not.toContain('Three');
    });

    test('formatted selection exports to markdown', async ({
      page,
      editorPage,
    }) => {
      await editorPage.setContents([
        { insert: 'Format ' },
        { insert: 'this', attributes: { bold: true } },
        { insert: '\n' },
      ]);
      await editorPage.selectText('this');
      await page.keyboard.press(`${SHORTKEY}+b`);
      const md = await editorPage.exportContent('markdown');
      expect(md).toContain('Format this');
    });
  });

  test.describe('undo and redo', () => {
    test('undo reverts import, redo restores', async ({ page, editorPage }) => {
      await editorPage.importContent('<p>Original</p>', 'html');
      await editorPage.cutoffHistory();
      await editorPage.importContent('<p>Replaced</p>', 'html');
      expect(await editorPage.getText()).toContain('Replaced');

      await editorPage.root.click();
      await undo(page);
      expect(await editorPage.getText()).toContain('Original');

      await redo(page);
      expect(await editorPage.getText()).toContain('Replaced');
    });

    test('export reflects state after undo', async ({ page, editorPage }) => {
      await editorPage.setContents([{ insert: 'Before\n' }]);
      await editorPage.cutoffHistory();
      await editorPage.setContents([{ insert: 'After\n' }]);
      await editorPage.root.click();
      await undo(page);
      const md = await editorPage.exportContent('markdown');
      expect(md).toContain('Before');
      expect(md).not.toContain('After');
    });
  });

  test.describe('native table safety', () => {
    test('markdown export rejects native editor tables', async ({
      editorPage,
    }) => {
      await editorPage.setContents([
        { insert: 'Cell' },
        { insert: '\n', attributes: { table: 'row-a' } },
      ]);
      await expect(
        editorPage.page.evaluate(() => {
          try {
            window.lextrix.exportContent('markdown');
            return 'ok';
          } catch (error) {
            return (error as Error).message;
          }
        }),
      ).resolves.toContain('native editor table');
    });
  });
});
