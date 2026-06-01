import NodeElementFactory from '../../factory/node-element-factory.js';
import DomBinding from '../../binding/dom-binding.js';
import ShadowNodeBehavior from '../../behavior/shadow-node-behavior.js';
import BlotDocumentNodeAdapter from '../../document/blot-document-node-adapter.js';
import type { DocumentNode } from '../../document/document-node.js';
import Scope from '../../scope.js';
import type {
  Blot,
  BlotConstructor,
  Parent,
  Root,
} from './blot.js';

/** Public compatibility facade — all behavior delegated to services. */
class ShadowBlot implements Blot {
  public static blotName = 'abstract';
  public static className: string;
  public static requiredContainer: BlotConstructor;
  public static scope: Scope;
  public static tagName: string | string[];

  public static create(rawValue?: unknown): Node {
    return NodeElementFactory.createFromBlot(this, rawValue);
  }

  public prev: Blot | null;
  public next: Blot | null;
  public parent: Parent;
  public readonly documentNode: DocumentNode;
  protected readonly binding: DomBinding;

  get statics(): any {
    return this.constructor;
  }

  constructor(
    public scroll: Root,
    public domNode: Node,
  ) {
    this.binding = new DomBinding(domNode, this);
    this.documentNode = BlotDocumentNodeAdapter.forBlot(this);
    this.prev = null;
    this.next = null;
  }

  public attach(): void {
    ShadowNodeBehavior.attach(this);
  }

  public clone(): Blot {
    return this.scroll.create(this.domNode.cloneNode(false));
  }

  public detach(): void {
    ShadowNodeBehavior.detach(this, this.binding);
  }

  public deleteAt(index: number, length: number): void {
    ShadowNodeBehavior.deleteAt(this, index, length);
  }

  public formatAt(
    index: number,
    length: number,
    name: string,
    value: unknown,
  ): void {
    ShadowNodeBehavior.formatAt(this, this.scroll, index, length, name, value);
  }

  public insertAt(index: number, value: string, def?: unknown): void {
    ShadowNodeBehavior.insertAt(this, this.scroll, index, value, def);
  }

  public isolate(index: number, length: number): Blot {
    return ShadowNodeBehavior.isolate(this, index, length);
  }

  public length(): number {
    return 1;
  }

  public offset(root: Blot = this.parent): number {
    if (this.parent == null || this === root) {
      return 0;
    }
    return this.parent.children.offset(this) + this.parent.offset(root);
  }

  public optimize(context?: { [key: string]: any }): void;
  public optimize(
    mutations: MutationRecord[],
    context?: { [key: string]: any },
  ): void;
  public optimize(
    mutations: MutationRecord[] | { [key: string]: any } = {},
    context: { [key: string]: any } = {},
  ): void {
    const ctx = Array.isArray(mutations) ? context : mutations;
    ShadowNodeBehavior.optimize(this, ctx);
  }

  public remove(): void {
    ShadowNodeBehavior.remove(this, this.binding);
  }

  public replaceWith(name: string | Blot, value?: unknown): Blot {
    return ShadowNodeBehavior.replaceWith(this, this.scroll, name, value);
  }

  public split(index: number, _force?: boolean): Blot | null {
    return index === 0 ? this : this.next;
  }

  public update(
    _mutations: MutationRecord[],
    _context: Record<string, unknown>,
  ): void {}

  public wrap(name: string | Parent, value?: unknown): Parent {
    return ShadowNodeBehavior.wrap(this, this.scroll, name, value);
  }
}

export default ShadowBlot;
