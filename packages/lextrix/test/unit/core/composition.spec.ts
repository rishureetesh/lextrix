import Emitter from 'lextrix-core/core/emitter.js';
import Composition from 'lextrix-core/core/composition.js';
import Scroll from 'lextrix-core/blots/scroll.js';
import { describe, expect, test, vitest } from 'vitest';
import { createRegistry } from '../__helpers__/factory.js';
import Lextrix from '../../../src/core.js';

describe('Composition', () => {
  test('triggers events on compositionstart', async () => {
    const emitter = new Emitter();
    const scroll = new Scroll(createRegistry(), document.createElement('div'), {
      emitter,
    });
    new Composition(scroll, emitter);

    vitest.spyOn(emitter, 'emit');

    const event = new CompositionEvent('compositionstart');
    scroll.domNode.dispatchEvent(event);
    expect(emitter.emit).toHaveBeenCalledWith(
      Lextrix.events.COMPOSITION_BEFORE_START,
      event,
    );
    expect(emitter.emit).toHaveBeenCalledWith(
      Lextrix.events.COMPOSITION_START,
      event,
    );
  });
});
