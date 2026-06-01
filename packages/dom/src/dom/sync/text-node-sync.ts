import TextBlot from '../blot/text.js';

/** Text node compaction and mutation sync policies. */
export class TextNodeSync {
  static readDomValue(textBlot: TextBlot): string {
    return textBlot.statics.value(textBlot.domNode);
  }

  static applyCharacterDataMutations(
    textBlot: TextBlot,
    mutations: MutationRecord[],
  ): boolean {
    const changed = mutations.some(
      (mutation) =>
        mutation.type === 'characterData' &&
        mutation.target === textBlot.domNode,
    );
    if (changed) {
      textBlot.syncTextFromDom();
    }
    return changed;
  }

  static compactAfterEdit(textBlot: TextBlot): void {
    textBlot.syncTextFromDom();
    if (textBlot.textLength() === 0) {
      textBlot.remove();
      return;
    }

    const next = textBlot.next;
    if (next instanceof TextBlot && next.prev === textBlot) {
      textBlot.insertAt(textBlot.textLength(), next.value());
      next.remove();
    }
  }
}

export default TextNodeSync;
