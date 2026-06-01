import { isEqual } from 'lodash-es';
import type { Blot } from 'lextrix-dom';
import ChangeSet from 'lextrix-change';
import { bubbleFormats } from '../../blots/block.js';
import CursorBlot from '../../blots/cursor.js';
import type Scroll from '../../blots/scroll.js';
import { Range } from '../selection.js';

const ASCII = /^[ -~]*$/;

export interface SelectionShift {
  oldRange: Range;
  newRange: Range;
}

export type ChangeSyncResult =
  | { mode: 'typing'; change: ChangeSet }
  | { mode: 'document'; change: ChangeSet; cached: ChangeSet };

function shiftRange({ index, length }: Range, amount: number): Range {
  return new Range(index + amount, length);
}

/** Reconciles editor change-set cache with the live document. */
export function syncChangeSet(
  scroll: Scroll,
  cached: ChangeSet,
  proposed: ChangeSet | null,
  mutations: MutationRecord[],
  selectionInfo?: SelectionShift,
): ChangeSyncResult {
  if (
    mutations.length === 1 &&
    mutations[0].type === 'characterData' &&
    // @ts-expect-error characterData target
    mutations[0].target.data.match(ASCII) &&
    scroll.find(mutations[0].target)
  ) {
    const textBlot = scroll.find(mutations[0].target) as Blot;
    const formats = bubbleFormats(textBlot);
    const index = textBlot.offset(scroll);
    // @ts-expect-error mutation record oldValue
    const oldValue = mutations[0].oldValue.replace(CursorBlot.CONTENTS, '');
    const oldText = new ChangeSet().insert(oldValue);
    // @ts-expect-error text value
    const newText = new ChangeSet().insert(textBlot.value());
    const relativeSelection = selectionInfo && {
      oldRange: shiftRange(selectionInfo.oldRange, -index),
      newRange: shiftRange(selectionInfo.newRange, -index),
    };
    const diffChangeSet = new ChangeSet()
      .retain(index)
      .concat(oldText.diff(newText, relativeSelection));
    const change = diffChangeSet.reduce((delta, op) => {
      if (op.insert) {
        return delta.insert(op.insert, formats);
      }
      return delta.push(op);
    }, new ChangeSet());
    return { mode: 'typing', change };
  }

  const live = scroll.lines().reduce(
    (delta, line) => delta.concat(line.changeSet()),
    new ChangeSet(),
  );

  let change = proposed;
  if (!change || !isEqual(cached.compose(change), live)) {
    change = cached.diff(live, selectionInfo);
  }

  return { mode: 'document', change: change!, cached: live };
}
