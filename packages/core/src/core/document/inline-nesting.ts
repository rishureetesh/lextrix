import { Scope } from 'lextrix-dom';

export const DEFAULT_INLINE_ORDER = [
  'cursor',
  'inline',
  'link',
  'underline',
  'strike',
  'italic',
  'bold',
  'script',
  'code',
] as const;

/** Declarative inline format nesting — replaces static Inline.order arrays. */
export class InlineNestingRules {
  constructor(private readonly order: readonly string[]) {}

  compare(self: string, other: string): number {
    const selfIndex = this.order.indexOf(self);
    const otherIndex = this.order.indexOf(other);
    if (selfIndex >= 0 || otherIndex >= 0) {
      return selfIndex - otherIndex;
    }
    if (self === other) return 0;
    return self < other ? -1 : 1;
  }

  shouldWrapBeforeFormat(
    blotName: string,
    formatName: string,
    scroll: { query(name: string, scope?: Scope): unknown },
  ): boolean {
    return (
      this.compare(blotName, formatName) < 0 &&
      scroll.query(formatName, Scope.BLOT) != null
    );
  }

  shouldReorderUnderParent(blotName: string, parentName: string): boolean {
    return this.compare(blotName, parentName) > 0;
  }
}

export const defaultInlineNesting = new InlineNestingRules(DEFAULT_INLINE_ORDER);

export default InlineNestingRules;
