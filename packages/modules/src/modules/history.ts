/** Lextron modules — editor behavior modules. */
import { Scope } from 'lextron-dom';
import type ChangeSet from 'lextron-change';
import Module from 'lextron-core/core/module.js';
import Lextron from 'lextron-core';
import type Scroll from 'lextron-core/blots/scroll.js';
import type { Range } from 'lextron-core/core/selection.js';

export interface HistoryOptions {
  userOnly: boolean;
  delay: number;
  maxStack: number;
}

export interface StackItem {
  changeSet: ChangeSet;
  range: Range | null;
}

interface Stack {
  undo: StackItem[];
  redo: StackItem[];
}

class History extends Module<HistoryOptions> {
  static DEFAULTS: HistoryOptions = {
    delay: 1000,
    maxStack: 100,
    userOnly: false,
  };

  lastRecorded = 0;
  ignoreChange = false;
  stack: Stack = { undo: [], redo: [] };
  currentRange: Range | null = null;

  constructor(lextron: Lextron, options: Partial<HistoryOptions>) {
    super(lextron, options);
    this.lextron.on(
      Lextron.events.EDITOR_CHANGE,
      (eventName, value, oldValue, source) => {
        if (eventName === Lextron.events.SELECTION_CHANGE) {
          if (value && source !== Lextron.sources.SILENT) {
            this.currentRange = value;
          }
        } else if (eventName === Lextron.events.TEXT_CHANGE) {
          if (!this.ignoreChange) {
            if (!this.options.userOnly || source === Lextron.sources.USER) {
              this.record(value, oldValue);
            } else {
              this.transform(value);
            }
          }

          this.currentRange = transformRange(this.currentRange, value);
        }
      },
    );

    this.lextron.keyboard.addBinding(
      { key: 'z', shortKey: true },
      this.undo.bind(this),
    );
    this.lextron.keyboard.addBinding(
      { key: ['z', 'Z'], shortKey: true, shiftKey: true },
      this.redo.bind(this),
    );
    if (/Win/i.test(navigator.platform)) {
      this.lextron.keyboard.addBinding(
        { key: 'y', shortKey: true },
        this.redo.bind(this),
      );
    }

    this.lextron.root.addEventListener('beforeinput', (event) => {
      if (event.inputType === 'historyUndo') {
        this.undo();
        event.preventDefault();
      } else if (event.inputType === 'historyRedo') {
        this.redo();
        event.preventDefault();
      }
    });
  }

  change(source: 'undo' | 'redo', dest: 'redo' | 'undo') {
    if (this.stack[source].length === 0) return;
    const item = this.stack[source].pop();
    if (!item) return;
    const base = this.lextron.getContents();
    const inverseChangeSet = item.changeSet.invert(base);
    this.stack[dest].push({
      changeSet: inverseChangeSet,
      range: transformRange(item.range, inverseChangeSet),
    });
    this.lastRecorded = 0;
    this.ignoreChange = true;
    this.lextron.updateContents(item.changeSet, Lextron.sources.USER);
    this.ignoreChange = false;

    this.restoreSelection(item);
  }

  clear() {
    this.stack = { undo: [], redo: [] };
  }

  cutoff() {
    this.lastRecorded = 0;
  }

  record(changeDelta: ChangeSet, oldDelta: ChangeSet) {
    if (changeDelta.ops.length === 0) return;
    this.stack.redo = [];
    let undoChangeSet = changeDelta.invert(oldDelta);
    let undoRange = this.currentRange;
    const timestamp = Date.now();
    if (
      // @ts-expect-error Fix me later
      this.lastRecorded + this.options.delay > timestamp &&
      this.stack.undo.length > 0
    ) {
      const item = this.stack.undo.pop();
      if (item) {
        undoChangeSet = undoChangeSet.compose(item.changeSet);
        undoRange = item.range;
      }
    } else {
      this.lastRecorded = timestamp;
    }
    if (undoChangeSet.length() === 0) return;
    this.stack.undo.push({ changeSet: undoChangeSet, range: undoRange });
    // @ts-expect-error Fix me later
    if (this.stack.undo.length > this.options.maxStack) {
      this.stack.undo.shift();
    }
  }

  redo() {
    this.change('redo', 'undo');
  }

  transform(delta: ChangeSet) {
    transformStack(this.stack.undo, delta);
    transformStack(this.stack.redo, delta);
  }

  undo() {
    this.change('undo', 'redo');
  }

  protected restoreSelection(stackItem: StackItem) {
    if (stackItem.range) {
      this.lextron.setSelection(stackItem.range, Lextron.sources.USER);
    } else {
      const index = getLastChangeIndex(this.lextron.scroll, stackItem.changeSet);
      this.lextron.setSelection(index, Lextron.sources.USER);
    }
  }
}

function transformStack(stack: StackItem[], delta: ChangeSet) {
  let remoteChangeSet = delta;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const oldItem = stack[i];
    stack[i] = {
      changeSet: remoteChangeSet.transform(oldItem.changeSet, true),
      range: oldItem.range && transformRange(oldItem.range, remoteChangeSet),
    };
    remoteChangeSet = oldItem.changeSet.transform(remoteChangeSet);
    if (stack[i].changeSet.length() === 0) {
      stack.splice(i, 1);
    }
  }
}

function endsWithNewlineChange(scroll: Scroll, delta: ChangeSet) {
  const lastOp = delta.ops[delta.ops.length - 1];
  if (lastOp == null) return false;
  if (lastOp.insert != null) {
    return typeof lastOp.insert === 'string' && lastOp.insert.endsWith('\n');
  }
  if (lastOp.attributes != null) {
    return Object.keys(lastOp.attributes).some((attr) => {
      return scroll.query(attr, Scope.BLOCK) != null;
    });
  }
  return false;
}

function getLastChangeIndex(scroll: Scroll, delta: ChangeSet) {
  const deleteLength = delta.reduce((length, op) => {
    return length + (op.delete || 0);
  }, 0);
  let changeIndex = delta.length() - deleteLength;
  if (endsWithNewlineChange(scroll, delta)) {
    changeIndex -= 1;
  }
  return changeIndex;
}

function transformRange(range: Range | null, delta: ChangeSet) {
  if (!range) return range;
  const start = delta.transformPosition(range.index);
  const end = delta.transformPosition(range.index + range.length);
  return { index: start, length: end - start };
}

export { History as default, getLastChangeIndex };
