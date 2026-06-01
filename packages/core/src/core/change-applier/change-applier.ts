import { merge } from 'lodash-es';
import { EmbedBlot, LeafBlot, Scope } from 'lextrix-dom';
import ChangeSet, { ChangeAttributes, ChangeOp } from 'lextrix-change';
import type Block from '../../blots/block.js';
import { BlockEmbed, bubbleFormats } from '../../blots/block.js';
import type Scroll from '../../blots/scroll.js';
import TextBlot from '../../blots/text.js';

export function splitOpsByLine(ops: ChangeOp[]): ChangeOp[] {
  const split: ChangeOp[] = [];
  ops.forEach((op) => {
    if (typeof op.insert === 'string') {
      const lines = op.insert.split('\n');
      lines.forEach((line, lineIndex) => {
        if (lineIndex) split.push({ insert: '\n', attributes: op.attributes });
        if (line) split.push({ insert: line, attributes: op.attributes });
      });
    } else {
      split.push(op);
    }
  });
  return split;
}

export function normalizeIncomingChange(change: ChangeSet): ChangeSet {
  return change.reduce((normalized, op) => {
    if (typeof op.insert === 'string') {
      const text = op.insert.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      return normalized.insert(text, op.attributes);
    }
    return normalized.push(op);
  }, new ChangeSet());
}

interface ApplyState {
  index: number;
  scrollLength: number;
}

/** Insert-phase of change application (separate from delete pass). */
class InsertPass {
  constructor(
    private readonly scroll: Scroll,
    private readonly deletePass: ChangeSet,
    private state: ApplyState,
  ) {}

  run(op: ChangeOp): void {
    const length = ChangeOp.length(op);
    let attributes: Record<string, unknown> = op.attributes || {};
    let prepended = 0;
    let appended = 0;

    if (op.insert != null) {
      this.deletePass.retain(length);
      if (typeof op.insert === 'string') {
        ({ appended, attributes } = this.applyTextInsert(
          op.insert,
          attributes,
        ));
      } else if (typeof op.insert === 'object' && op.insert) {
        const key = Object.keys(op.insert)[0];
        if (key == null) return;
        ({ prepended, appended, attributes } = this.applyEmbedInsert(
          op.insert,
          attributes,
        ));
      }
      this.state.scrollLength += length;
    } else {
      this.deletePass.push(op);
      if (op.retain != null && typeof op.retain === 'object') {
        const key = Object.keys(op.retain)[0];
        if (key != null) {
          this.scroll.updateEmbedAt(this.state.index, key, op.retain[key]);
        }
      }
    }

    Object.keys(attributes).forEach((name) => {
      this.scroll.formatAt(this.state.index, length, name, attributes[name]);
    });

    this.state.scrollLength += prepended + appended;
    this.deletePass.retain(prepended);
    this.deletePass.delete(appended);
    this.state.index += length + prepended + appended;
  }

  private applyTextInsert(text: string, attributes: Record<string, unknown>) {
    let appended = 0;
    appended =
      !text.endsWith('\n') &&
      (this.state.scrollLength <= this.state.index ||
        !!this.scroll.descendant(BlockEmbed, this.state.index)[0])
        ? 1
        : 0;
    this.scroll.insertAt(this.state.index, text);
    const [line, offset] = this.scroll.line(this.state.index);
    let formats = merge({}, bubbleFormats(line));
    if (line instanceof Object && 'descendant' in line) {
      const [leaf] = (line as Block).descendant(LeafBlot, offset);
      if (leaf) {
        formats = merge(formats, bubbleFormats(leaf));
      }
    }
    attributes = ChangeAttributes.diff(formats, attributes) || {};
    return { appended, attributes };
  }

  private applyEmbedInsert(
    insert: Record<string, unknown>,
    attributes: Record<string, unknown>,
  ) {
    let prepended = 0;
    let appended = 0;
    const key = Object.keys(insert)[0];
    if (key == null) return { prepended, appended, attributes };

    const isInlineEmbed = this.scroll.query(key, Scope.INLINE) != null;
    if (isInlineEmbed) {
      if (
        this.state.scrollLength <= this.state.index ||
        !!this.scroll.descendant(BlockEmbed, this.state.index)[0]
      ) {
        appended = 1;
      }
    } else if (this.state.index > 0) {
      const [leaf, offset] = this.scroll.descendant(
        LeafBlot,
        this.state.index - 1,
      );
      if (leaf instanceof TextBlot) {
        if (leaf.value()[offset] !== '\n') prepended = 1;
      } else if (
        leaf instanceof EmbedBlot &&
        leaf.statics.scope === Scope.INLINE_BLOT
      ) {
        prepended = 1;
      }
    }
    this.scroll.insertAt(this.state.index, key, insert[key]);
    if (isInlineEmbed) {
      const [leaf] = this.scroll.descendant(LeafBlot, this.state.index);
      if (leaf) {
        attributes =
          ChangeAttributes.diff(merge({}, bubbleFormats(leaf)), attributes) ||
          {};
      }
    }
    return { prepended, appended, attributes };
  }
}

/** Delete-phase of change application. */
class DeletePass {
  constructor(private readonly scroll: Scroll) {}

  run(deletePass: ChangeSet): void {
    deletePass.reduce((index, op) => {
      if (typeof op.delete === 'number') {
        this.scroll.deleteAt(index, op.delete);
        return index;
      }
      return index + ChangeOp.length(op);
    }, 0);
  }
}

/** Applies change-set operations to the live scroll tree. */
export class ChangeApplier {
  private readonly deleteRunner: DeletePass;

  constructor(private readonly scroll: Scroll) {
    this.deleteRunner = new DeletePass(scroll);
  }

  apply(raw: ChangeSet): ChangeSet {
    this.scroll.update();
    this.scroll.batchStart();

    const normalized = normalizeIncomingChange(raw);
    const deletePass = new ChangeSet();
    const ops = splitOpsByLine(normalized.ops.slice());
    const state: ApplyState = {
      index: 0,
      scrollLength: this.scroll.length(),
    };
    const insertRunner = new InsertPass(this.scroll, deletePass, state);

    for (const op of ops) {
      insertRunner.run(op);
    }

    this.deleteRunner.run(deletePass);
    this.scroll.batchEnd();
    this.scroll.optimize();
    return normalized;
  }
}
