/** Lextron modules — editor behavior modules. */
import ChangeSet from 'lextron-change';
import Lextron from 'lextron-core';
import Module from 'lextron-core/core/module.js';
import {
  TableCell,
  TableRow,
  TableBody,
  TableContainer,
  tableId,
} from 'lextron-formats/formats/table.js';

class Table extends Module {
  static register() {
    Lextron.register(TableCell);
    Lextron.register(TableRow);
    Lextron.register(TableBody);
    Lextron.register(TableContainer);
  }

  constructor(...args: ConstructorParameters<typeof Module>) {
    super(...args);
    this.listenBalanceCells();
  }

  balanceTables() {
    this.lextron.scroll.descendants(TableContainer).forEach((table) => {
      table.balanceCells();
    });
  }

  deleteColumn() {
    const [table, , cell] = this.getTable();
    if (cell == null) return;
    // @ts-expect-error
    table.deleteColumn(cell.cellOffset());
    this.lextron.update(Lextron.sources.USER);
  }

  deleteRow() {
    const [, row] = this.getTable();
    if (row == null) return;
    row.remove();
    this.lextron.update(Lextron.sources.USER);
  }

  deleteTable() {
    const [table] = this.getTable();
    if (table == null) return;
    // @ts-expect-error
    const offset = table.offset();
    // @ts-expect-error
    table.remove();
    this.lextron.update(Lextron.sources.USER);
    this.lextron.setSelection(offset, Lextron.sources.SILENT);
  }

  getTable(
    range = this.lextron.getSelection(),
  ): [null, null, null, -1] | [Table, TableRow, TableCell, number] {
    if (range == null) return [null, null, null, -1];
    const [cell, offset] = this.lextron.getLine(range.index);
    if (cell == null || cell.statics.blotName !== TableCell.blotName) {
      return [null, null, null, -1];
    }
    const row = cell.parent;
    const table = row.parent.parent;
    // @ts-expect-error
    return [table, row, cell, offset];
  }

  insertColumn(offset: number) {
    const range = this.lextron.getSelection();
    if (!range) return;
    const [table, row, cell] = this.getTable(range);
    if (cell == null) return;
    const column = cell.cellOffset();
    table.insertColumn(column + offset);
    this.lextron.update(Lextron.sources.USER);
    let shift = row.rowOffset();
    if (offset === 0) {
      shift += 1;
    }
    this.lextron.setSelection(
      range.index + shift,
      range.length,
      Lextron.sources.SILENT,
    );
  }

  insertColumnLeft() {
    this.insertColumn(0);
  }

  insertColumnRight() {
    this.insertColumn(1);
  }

  insertRow(offset: number) {
    const range = this.lextron.getSelection();
    if (!range) return;
    const [table, row, cell] = this.getTable(range);
    if (cell == null) return;
    const index = row.rowOffset();
    table.insertRow(index + offset);
    this.lextron.update(Lextron.sources.USER);
    if (offset > 0) {
      this.lextron.setSelection(range, Lextron.sources.SILENT);
    } else {
      this.lextron.setSelection(
        range.index + row.children.length,
        range.length,
        Lextron.sources.SILENT,
      );
    }
  }

  insertRowAbove() {
    this.insertRow(0);
  }

  insertRowBelow() {
    this.insertRow(1);
  }

  insertTable(rows: number, columns: number) {
    const range = this.lextron.getSelection();
    if (range == null) return;
    const delta = new Array(rows).fill(0).reduce((memo) => {
      const text = new Array(columns).fill('\n').join('');
      return memo.insert(text, { table: tableId() });
    }, new ChangeSet().retain(range.index));
    this.lextron.updateContents(delta, Lextron.sources.USER);
    this.lextron.setSelection(range.index, Lextron.sources.SILENT);
    this.balanceTables();
  }

  listenBalanceCells() {
    this.lextron.on(
      Lextron.events.SCROLL_OPTIMIZE,
      (mutations: MutationRecord[]) => {
        mutations.some((mutation) => {
          if (
            ['TD', 'TR', 'TBODY', 'TABLE'].includes(
              (mutation.target as HTMLElement).tagName,
            )
          ) {
            this.lextron.once(Lextron.events.TEXT_CHANGE, (delta, old, source) => {
              if (source !== Lextron.sources.USER) return;
              this.balanceTables();
            });
            return true;
          }
          return false;
        });
      },
    );
  }
}

export default Table;
