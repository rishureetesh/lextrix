import LinkedList from '../../collection/linked-list.js';
import BlotMountFactory from '../../factory/blot-mount-factory.js';
import ParentMutationSync from '../../sync/parent-mutation-sync.js';
import FormatDefinitionCatalog from '../../format/format-definition.js';
import NodeTree from '../../tree/node-tree.js';
import TreeCursor from '../../tree/tree-cursor.js';
import TreeMutationService from '../../tree/tree-mutation-service.js';
import DomError from '../../error.js';
import Scope from '../../scope.js';
import type { Blot, BlotConstructor, Parent, Root } from './blot.js';
import ShadowBlot from './shadow.js';

const mutationSync = new ParentMutationSync();

class ParentBlot extends ShadowBlot implements Parent {
  /**
   * Whitelist array of Blots that can be direct children.
   */
  public static allowedChildren?: BlotConstructor[];

  /**
   * Default child blot to be inserted if this blot becomes empty.
   */
  public static defaultChild?: BlotConstructor;
  public static uiClass = '';

  public children!: LinkedList<Blot>;
  public domNode!: HTMLElement;
  public uiNode: HTMLElement | null = null;

  protected readonly tree = new NodeTree();
  protected readonly treeCursor = new TreeCursor(this.tree);
  protected readonly treeMutation = new TreeMutationService(this.tree);

  constructor(scroll: Root, domNode: Node) {
    super(scroll, domNode);
    this.children = this.tree.children;
    this.build();
  }

  public appendChild(other: Blot): void {
    this.insertBefore(other);
  }

  public attach(): void {
    super.attach();
    this.children.forEach((child) => {
      child.attach();
    });
  }

  public attachUI(node: HTMLElement): void {
    if (this.uiNode != null) {
      this.uiNode.remove();
    }
    this.uiNode = node;
    if (ParentBlot.uiClass) {
      this.uiNode.classList.add(ParentBlot.uiClass);
    }
    this.uiNode.setAttribute('contenteditable', 'false');
    this.domNode.insertBefore(this.uiNode, this.domNode.firstChild);
  }

  /**
   * Called during construction, should fill its own children LinkedList.
   */
  public build(): void {
    while (this.tree.length > 0) {
      this.tree.remove(this.tree.children.head!);
    }
    // Need to be reversed for if DOM nodes already in order
    Array.from(this.domNode.childNodes)
      .filter((node: Node) => node !== this.uiNode)
      .reverse()
      .forEach((node: Node) => {
        try {
          const child = BlotMountFactory.attachNode(node, this.scroll);
          this.insertBefore(child, this.children.head || undefined);
        } catch (err) {
          if (err instanceof DomError) {
            return;
          } else {
            throw err;
          }
        }
      });
  }

  public deleteAt(index: number, length: number): void {
    if (index === 0 && length === this.length()) {
      return this.remove();
    }
    this.children.forEachAt(index, length, (child, offset, childLength) => {
      child.deleteAt(offset, childLength);
    });
  }

  public descendant<T extends Blot>(
    criteria: new (...args: any[]) => T,
    index: number,
  ): [T | null, number];
  public descendant(
    criteria: (blot: Blot) => boolean,
    index: number,
  ): [Blot | null, number];
  public descendant(criteria: any, index = 0): [Blot | null, number] {
    return this.treeCursor.descendant(this, criteria, index);
  }

  public descendants<T extends Blot>(
    criteria: new (...args: any[]) => T,
    index?: number,
    length?: number,
  ): T[];
  public descendants(
    criteria: (blot: Blot) => boolean,
    index?: number,
    length?: number,
  ): Blot[];
  public descendants(
    criteria: any,
    index = 0,
    length: number = Number.MAX_VALUE,
  ): Blot[] {
    return this.treeCursor.descendants(this, criteria, index, length);
  }

  public detach(): void {
    this.children.forEach((child) => {
      child.detach();
    });
    super.detach();
  }

  public enforceAllowedChildren(): void {
    let done = false;
    this.children.forEach((child: Blot) => {
      if (done) {
        return;
      }
      const allowed = this.statics.allowedChildren.some(
        (def: BlotConstructor) => child instanceof def,
      );
      if (allowed) {
        return;
      }
      if (child.statics.scope === Scope.BLOCK_BLOT) {
        if (child.next != null) {
          this.splitAfter(child);
        }
        if (child.prev != null) {
          this.splitAfter(child.prev);
        }
        child.parent.unwrap();
        done = true;
      } else if (child instanceof ParentBlot) {
        child.unwrap();
      } else {
        child.remove();
      }
    });
  }

  public formatAt(
    index: number,
    length: number,
    name: string,
    value: any,
  ): void {
    this.children.forEachAt(index, length, (child, offset, childLength) => {
      child.formatAt(offset, childLength, name, value);
    });
  }

  public insertAt(index: number, value: string, def?: any): void {
    const [child, offset] = this.children.find(index);
    if (child) {
      child.insertAt(offset, value, def);
    } else {
      const blot =
        def == null
          ? this.scroll.create('text', value)
          : this.scroll.create(value, def);
      this.appendChild(blot);
    }
  }

  public insertBefore(childBlot: Blot, refBlot?: Blot | null): void {
    this.treeMutation.insertBefore(this, childBlot, refBlot);
  }

  public length(): number {
    return this.tree.contentLength();
  }

  public moveChildren(targetParent: Parent, refNode?: Blot | null): void {
    this.treeMutation.moveChildren(this, targetParent, refNode);
  }

  public optimize(context?: { [key: string]: any }): void {
    super.optimize(context);
    this.enforceAllowedChildren();
    if (this.uiNode != null && this.uiNode !== this.domNode.firstChild) {
      this.domNode.insertBefore(this.uiNode, this.domNode.firstChild);
    }
    if (this.children.length === 0) {
      if (this.statics.defaultChild != null) {
        const child = this.scroll.create(this.statics.defaultChild.blotName);
        this.appendChild(child);
        // TODO double check if necessary
        // child.optimize(context);
      } else {
        this.remove();
      }
    }
    FormatDefinitionCatalog.runPostOptimize(this, context ?? {});
  }

  public path(index: number, inclusive = false): [Blot, number][] {
    return this.treeCursor.path(this, index, inclusive);
  }

  public removeChild(child: Blot): void {
    this.treeMutation.removeChild(this, child);
  }

  public replaceWith(name: string | Blot, value?: any): Blot {
    const replacement =
      typeof name === 'string' ? this.scroll.create(name, value) : name;
    this.treeMutation.prepareReplaceWith(this, replacement);
    return super.replaceWith(replacement);
  }

  public split(index: number, force = false): Blot | null {
    return this.treeMutation.split(this, index, force);
  }

  public splitAfter(child: Blot): Parent {
    return this.treeMutation.splitAfter(this, child);
  }

  public unwrap(): void {
    this.treeMutation.unwrap(this);
  }

  public update(
    mutations: MutationRecord[],
    _context: { [key: string]: any },
  ): void {
    mutationSync.reconcile(this, mutations, this.scroll, this.uiNode);
    this.enforceAllowedChildren();
  }
}

export default ParentBlot;
