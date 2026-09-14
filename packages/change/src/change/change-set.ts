import type fastDiff from 'fast-diff';
import ChangeAttributes from './change-attributes.js';
import ChangeOp from './change-op.js';
import ChangeIterator from './change-iterator.js';
import { composeChangeSets } from './compose.js';
import { diffChangeSets } from './diff.js';
import {
  type EmbedHandler,
  registerEmbedHandler,
  unregisterEmbedHandler,
} from './embed-handlers.js';
import { invertChangeSet } from './invert.js';
import { transformChangeSets, transformPosition } from './transform.js';
import { OperationBuffer } from '../document/operation-buffer.js';
import { fromLegacyOps, toLegacyOps } from '../operation/legacy-bridge.js';
import {
  eachLineOperations,
  sliceLegacyOps,
} from '../pipeline/operation-stream-nav.js';

class ChangeSet {
  static ChangeOp = ChangeOp;
  static ChangeIterator = ChangeIterator;
  static ChangeAttributes = ChangeAttributes;

  static registerEmbed<T>(embedType: string, handler: EmbedHandler<T>): void {
    registerEmbedHandler(embedType, handler);
  }

  static unregisterEmbed(embedType: string): void {
    unregisterEmbedHandler(embedType);
  }

  ops: ChangeOp[];
  private frozen = false;

  constructor(ops?: ChangeOp[] | { ops: ChangeOp[] }) {
    if (Array.isArray(ops)) {
      this.ops = ops;
    } else if (ops != null && Array.isArray(ops.ops)) {
      this.ops = ops.ops;
    } else {
      this.ops = [];
    }
  }

  /** Deep-enough clone of ops for safe sharing (attributes shallow-copied). */
  clone(): ChangeSet {
    return new ChangeSet(
      this.ops.map((op) => {
        const next: ChangeOp = { ...op };
        if (op.attributes) {
          next.attributes = { ...op.attributes };
        }
        return next;
      }),
    );
  }

  /**
   * Freeze this ChangeSet against further builder mutation (push/chop/insert/…).
   * OT methods (compose/diff/transform) still return new instances.
   * Builder methods remain mutable by design for Quill-compatible chaining;
   * freeze documents once they leave the builder.
   */
  freeze(): this {
    this.frozen = true;
    Object.freeze(this.ops);
    return this;
  }

  get isFrozen(): boolean {
    return this.frozen;
  }

  private assertMutable(): void {
    if (this.frozen) {
      throw new Error(
        'Cannot mutate a frozen ChangeSet. Use clone() before editing.',
      );
    }
  }

  insert(
    arg: string | Record<string, unknown>,
    attributes?: ChangeAttributes | null,
  ): this {
    const newChangeOp: ChangeOp = {};
    if (typeof arg === 'string' && arg.length === 0) {
      return this;
    }
    newChangeOp.insert = arg;
    if (
      attributes != null &&
      typeof attributes === 'object' &&
      Object.keys(attributes).length > 0
    ) {
      newChangeOp.attributes = attributes;
    }
    return this.push(newChangeOp);
  }

  delete(length: number): this {
    if (length <= 0) {
      return this;
    }
    return this.push({ delete: length });
  }

  retain(
    length: number | Record<string, unknown>,
    attributes?: ChangeAttributes | null,
  ): this {
    if (typeof length === 'number' && length <= 0) {
      return this;
    }
    const newChangeOp: ChangeOp = { retain: length };
    if (
      attributes != null &&
      typeof attributes === 'object' &&
      Object.keys(attributes).length > 0
    ) {
      newChangeOp.attributes = attributes;
    }
    return this.push(newChangeOp);
  }

  push(newChangeOp: ChangeOp): this {
    this.assertMutable();
    const buffer = OperationBuffer.fromLegacyOps(this.ops);
    buffer.appendLegacy(newChangeOp);
    this.ops = buffer.toLegacyOps();
    return this;
  }

  chop(): this {
    this.assertMutable();
    const buffer = OperationBuffer.fromLegacyOps(this.ops);
    buffer.chopTrailingRetain();
    this.ops = buffer.toLegacyOps();
    return this;
  }

  filter(predicate: (op: ChangeOp, index: number) => boolean): ChangeOp[] {
    return this.ops.filter(predicate);
  }

  forEach(predicate: (op: ChangeOp, index: number) => void): void {
    this.ops.forEach(predicate);
  }

  map<T>(predicate: (op: ChangeOp, index: number) => T): T[] {
    return this.ops.map(predicate);
  }

  partition(predicate: (op: ChangeOp) => boolean): [ChangeOp[], ChangeOp[]] {
    const passed: ChangeOp[] = [];
    const failed: ChangeOp[] = [];
    this.forEach((op) => {
      const target = predicate(op) ? passed : failed;
      target.push(op);
    });
    return [passed, failed];
  }

  reduce<T>(
    predicate: (accum: T, curr: ChangeOp, index: number) => T,
    initialValue: T,
  ): T {
    return this.ops.reduce(predicate, initialValue);
  }

  changeLength(): number {
    return this.reduce((length, elem) => {
      if (elem.insert) {
        return length + ChangeOp.length(elem);
      } else if (elem.delete) {
        return length - elem.delete;
      }
      return length;
    }, 0);
  }

  length(): number {
    return this.reduce((length, elem) => {
      return length + ChangeOp.length(elem);
    }, 0);
  }

  slice(start = 0, end = Infinity): ChangeSet {
    return new ChangeSet(sliceLegacyOps(this.ops, start, end));
  }

  compose(other: ChangeSet): ChangeSet {
    return composeChangeSets(this, other);
  }

  concat(other: ChangeSet): ChangeSet {
    const result = new ChangeSet(this.ops.slice());
    if (other.ops.length > 0) {
      result.push(other.ops[0]);
      result.ops = result.ops.concat(other.ops.slice(1));
    }
    return result;
  }

  diff(other: ChangeSet, cursor?: number | fastDiff.CursorInfo): ChangeSet {
    return diffChangeSets(this, other, cursor);
  }

  eachLine(
    predicate: (
      line: ChangeSet,
      attributes: ChangeAttributes,
      index: number,
    ) => boolean | void,
    newline = '\n',
  ): void {
    eachLineOperations(
      fromLegacyOps(this.ops),
      (lineOps, attributes, index) =>
        predicate(new ChangeSet(toLegacyOps(lineOps)), attributes, index),
      newline,
    );
  }

  invert(base: ChangeSet): ChangeSet {
    return invertChangeSet(this, base);
  }

  transform(index: number, priority?: boolean): number;
  transform(other: ChangeSet, priority?: boolean): ChangeSet;
  transform(arg: number | ChangeSet, priority = false): typeof arg {
    priority = !!priority;
    if (typeof arg === 'number') {
      return transformPosition(this, arg, priority) as typeof arg;
    }
    return transformChangeSets(this, arg, priority) as typeof arg;
  }

  transformPosition(index: number, priority = false): number {
    return transformPosition(this, index, priority);
  }
}

export default ChangeSet;
export { ChangeOp, ChangeIterator, ChangeAttributes };
