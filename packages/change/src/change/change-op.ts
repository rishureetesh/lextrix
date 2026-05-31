import ChangeAttributes from './change-attributes.js';

interface ChangeOp {
  // only one property out of {insert, delete, retain} will be present
  insert?: string | Record<string, unknown>;
  delete?: number;
  retain?: number | Record<string, unknown>;

  attributes?: ChangeAttributes;
}

namespace ChangeOp {
  export function length(op: ChangeOp): number {
    if (typeof op.delete === 'number') {
      return op.delete;
    } else if (typeof op.retain === 'number') {
      return op.retain;
    } else if (typeof op.retain === 'object' && op.retain !== null) {
      return 1;
    } else {
      return typeof op.insert === 'string' ? op.insert.length : 1;
    }
  }
}

export default ChangeOp;
