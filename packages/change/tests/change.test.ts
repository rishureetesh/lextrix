import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';

describe('lextrix-change', () => {
  it('composes insert ops', () => {
    const a = new ChangeSet().insert('Hello');
    const b = new ChangeSet().retain(5).insert(' World');
    const c = a.compose(b);
    expect(c.ops).toEqual([{ insert: 'Hello World' }]);
  });

  it('transforms concurrent inserts', () => {
    const a = new ChangeSet().retain(3).insert('a');
    const b = new ChangeSet().retain(3).insert('b');
    const aPrime = a.transform(b, true);
    const bPrime = b.transform(a, false);
    expect(aPrime.ops).toEqual([{ retain: 4 }, { insert: 'b' }]);
    expect(bPrime.ops).toEqual([{ retain: 3 }, { insert: 'a' }]);
  });
});
