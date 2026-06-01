import Scope from '../../scope.js';
import LeafRangeMapper from '../../selection/leaf-range-mapper.js';
import type { Leaf } from './blot.js';
import ShadowBlot from './shadow.js';

class LeafBlot extends ShadowBlot implements Leaf {
  public static scope = Scope.INLINE_BLOT;

  public static value(_domNode: Node): any {
    return true;
  }

  public index(node: Node, offset: number): number {
    return LeafRangeMapper.index(this, node, offset);
  }

  public position(index: number, inclusive?: boolean): [Node, number] {
    return LeafRangeMapper.position(this, index, inclusive);
  }

  public value(): any {
    return {
      [this.statics.blotName]: this.statics.value(this.domNode) || true,
    };
  }
}

export default LeafBlot;
