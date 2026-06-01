import Scope from '../scope.js';
import TextNodeSync from '../sync/text-node-sync.js';
import type { Blot, Leaf, Root } from './abstract/blot.js';
import LeafBlot from './abstract/leaf.js';

class TextBlot extends LeafBlot implements Leaf {
  public static readonly blotName = 'text';
  public static scope = Scope.INLINE_BLOT;

  public static create(value: string): Text {
    return document.createTextNode(value);
  }

  public static value(domNode: Text): string {
    return domNode.data;
  }

  public domNode!: Text;
  protected text: string;

  constructor(scroll: Root, node: Node) {
    super(scroll, node);
    this.text = this.statics.value(this.domNode);
  }

  public syncTextFromDom(): void {
    this.text = this.statics.value(this.domNode);
  }

  public textLength(): number {
    return this.text.length;
  }

  public deleteAt(index: number, length: number): void {
    this.domNode.data = this.text =
      this.text.slice(0, index) + this.text.slice(index + length);
  }

  public index(node: Node, offset: number): number {
    if (this.domNode === node) {
      return offset;
    }
    return -1;
  }

  public insertAt(index: number, value: string, def?: any): void {
    if (def == null) {
      this.text = this.text.slice(0, index) + value + this.text.slice(index);
      this.domNode.data = this.text;
    } else {
      super.insertAt(index, value, def);
    }
  }

  public length(): number {
    return this.text.length;
  }

  public optimize(context: { [key: string]: any }): void {
    super.optimize(context);
    TextNodeSync.compactAfterEdit(this);
  }

  public position(index: number, _inclusive = false): [Node, number] {
    return [this.domNode, index];
  }

  public split(index: number, force = false): Blot | null {
    if (!force) {
      if (index === 0) {
        return this;
      }
      if (index === this.length()) {
        return this.next;
      }
    }
    const after = this.scroll.create(this.domNode.splitText(index));
    this.parent.insertBefore(after, this.next || undefined);
    this.syncTextFromDom();
    return after;
  }

  public update(
    mutations: MutationRecord[],
    _context: { [key: string]: any },
  ): void {
    TextNodeSync.applyCharacterDataMutations(this, mutations);
  }

  public value(): string {
    return this.text;
  }
}

export default TextBlot;
