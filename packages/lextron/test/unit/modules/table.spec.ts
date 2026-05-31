import ChangeSet from 'lextron-change';
import Lextron from '../../../src/core.js';
import { lxtPath } from 'lextron-core';
import { describe, expect, test } from 'vitest';
import { createRegistry } from '../__helpers__/factory.js';
import {
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from 'lextron-formats/formats/table.js';
import { normalizeHTML } from '../__helpers__/utils.js';
import Table from 'lextron-modules/modules/table.js';

const createLextron = (html: string) => {
  Lextron.register({ [lxtPath.module('table')]: Table }, true);
  const container = document.body.appendChild(document.createElement('div'));
  container.innerHTML = normalizeHTML(html);
  const editor = new Lextron(container, {
    modules: { table: true },
    registry: createRegistry([TableBody, TableCell, TableContainer, TableRow]),
  });
  return editor;
};

describe('Table Module', () => {
  describe('insert table', () => {
    test('empty', () => {
      const editor = createLextron('<p><br></p>');
      const table = editor.getModule('table') as Table;
      editor.setSelection(0);
      table.insertTable(2, 3);
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td><br></td><td><br></td><td><br></td></tr>
            <tr><td><br></td><td><br></td><td><br></td></tr>
          </tbody>
        </table>
        <p><br></p>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('split', () => {
      const editor = createLextron('<p>0123</p>');
      const table = editor.getModule('table') as Table;
      editor.setSelection(2);
      table.insertTable(2, 3);
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td>01</td><td><br></td><td><br></td></tr>
            <tr><td><br></td><td><br></td><td><br></td></tr>
          </tbody>
        </table>
        <p>23</p>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });
  });

  describe('modify table', () => {
    const setup = () => {
      const tableHTML = `
        <table>
          <tbody>
            <tr><td>a1</td><td>a2</td><td>a3</td></tr>
            <tr><td>b1</td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `;
      const editor = createLextron(tableHTML);
      const table = editor.getModule('table') as Table;
      return { editor, table };
    };

    test('insertRowAbove', () => {
      const { editor, table } = setup();
      editor.setSelection(0);
      table.insertRowAbove();
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td><br></td><td><br></td><td><br></td></tr>
            <tr><td>a1</td><td>a2</td><td>a3</td></tr>
            <tr><td>b1</td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('insertRowBelow', () => {
      const { editor, table } = setup();
      editor.setSelection(0);
      table.insertRowBelow();
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td>a1</td><td>a2</td><td>a3</td></tr>
            <tr><td><br></td><td><br></td><td><br></td></tr>
            <tr><td>b1</td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('insertColumnLeft', () => {
      const { editor, table } = setup();
      editor.setSelection(0);
      table.insertColumnLeft();
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td><br></td><td>a1</td><td>a2</td><td>a3</td></tr>
            <tr><td><br></td><td>b1</td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('insertColumnRight', () => {
      const { editor, table } = setup();
      editor.setSelection(0);
      table.insertColumnRight();
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td>a1</td><td><br></td><td>a2</td><td>a3</td></tr>
            <tr><td>b1</td><td><br></td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('deleteRow', () => {
      const { editor, table } = setup();
      editor.setSelection(0);
      table.deleteRow();
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td>b1</td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('deleteColumn', () => {
      const { editor, table } = setup();
      editor.setSelection(0);
      table.deleteColumn();
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td>a2</td><td>a3</td></tr>
            <tr><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('insertText before', () => {
      const { editor } = setup();
      editor.updateContents(new ChangeSet().insert('\n'));
      expect(editor.root).toEqualHTML(
        `
        <p><br></p>
        <table>
          <tbody>
            <tr><td>a1</td><td>a2</td><td>a3</td></tr>
            <tr><td>b1</td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });

    test('insertText after', () => {
      const { editor } = setup();
      editor.updateContents(new ChangeSet().retain(18).insert('\n'));
      expect(editor.root).toEqualHTML(
        `
        <table>
          <tbody>
            <tr><td>a1</td><td>a2</td><td>a3</td></tr>
            <tr><td>b1</td><td>b2</td><td>b3</td></tr>
          </tbody>
        </table>
        <p><br></p>
      `,
        { ignoreAttrs: ['data-row'] },
      );
    });
  });
});
