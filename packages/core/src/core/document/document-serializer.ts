import { LeafBlot } from 'lextrix-dom';
import type { Blot } from 'lextrix-dom';
import type { BlockBlot } from 'lextrix-dom';
import ChangeSet from 'lextrix-change';

/** Serializes live document nodes to change-set operations. */
export function blotToChangeSet(blot: BlockBlot, filter = true): ChangeSet {
  return blot
    .descendants(LeafBlot)
    .reduce((delta, leaf) => {
      if (leaf.length() === 0) return delta;
      return delta.insert(leaf.value(), bubbleFormats(leaf, {}, filter));
    }, new ChangeSet())
    .insert('\n', bubbleFormats(blot));
}

export function bubbleFormats(
  blot: Blot | null,
  formats: Record<string, unknown> = {},
  filter = true,
): Record<string, unknown> {
  if (blot == null) return formats;
  if ('formats' in blot && typeof blot.formats === 'function') {
    formats = { ...formats, ...blot.formats() };
    if (filter) {
      delete formats['code-token'];
    }
  }
  if (
    blot.parent == null ||
    blot.parent.statics.blotName === 'scroll' ||
    blot.parent.statics.scope !== blot.statics.scope
  ) {
    return formats;
  }
  return bubbleFormats(blot.parent, formats, filter);
}
