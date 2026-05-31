/** Lextron core — document editor shell. */
import { EmbedBlot } from 'lextron-dom';

class Break extends EmbedBlot {
  static value() {
    return undefined;
  }

  optimize() {
    if (this.prev || this.next) {
      this.remove();
    }
  }

  length() {
    return 0;
  }

  value() {
    return '';
  }
}
Break.blotName = 'break';
Break.tagName = 'BR';

export default Break;
