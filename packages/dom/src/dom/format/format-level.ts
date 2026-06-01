import Scope from '../scope.js';

/**
 * Lextrix format levels — explicit categories instead of raw Parchment Scope bitmasks.
 */
export enum FormatLevel {
  Inline = 'inline',
  Block = 'block',
}

export enum FormatKind {
  Blot = 'blot',
  Attribute = 'attribute',
}

export type FormatCategory = {
  level: FormatLevel;
  kind: FormatKind;
};

export const FormatCategory = {
  inlineBlot: { level: FormatLevel.Inline, kind: FormatKind.Blot },
  blockBlot: { level: FormatLevel.Block, kind: FormatKind.Blot },
  inlineAttribute: { level: FormatLevel.Inline, kind: FormatKind.Attribute },
  blockAttribute: { level: FormatLevel.Block, kind: FormatKind.Attribute },
} as const satisfies Record<string, FormatCategory>;

export function categoryFromScope(scope: number): FormatCategory | null {
  if (scope === Scope.INLINE_BLOT) return FormatCategory.inlineBlot;
  if (scope === Scope.BLOCK_BLOT) return FormatCategory.blockBlot;
  if (scope === Scope.INLINE_ATTRIBUTE) return FormatCategory.inlineAttribute;
  if (scope === Scope.BLOCK_ATTRIBUTE) return FormatCategory.blockAttribute;
  if ((scope & Scope.LEVEL) === Scope.BLOT && (scope & Scope.TYPE) === Scope.INLINE) {
    return FormatCategory.inlineBlot;
  }
  if ((scope & Scope.LEVEL) === Scope.BLOT && (scope & Scope.TYPE) === Scope.BLOCK) {
    return FormatCategory.blockBlot;
  }
  if ((scope & Scope.LEVEL) === Scope.ATTRIBUTE && (scope & Scope.TYPE) === Scope.INLINE) {
    return FormatCategory.inlineAttribute;
  }
  if ((scope & Scope.LEVEL) === Scope.ATTRIBUTE && (scope & Scope.TYPE) === Scope.BLOCK) {
    return FormatCategory.blockAttribute;
  }
  return null;
}
