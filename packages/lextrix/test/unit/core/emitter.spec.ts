import { describe, expect, test } from 'vitest';
import Emitter from 'lextrix-core/core/emitter.js';
import Lextrix from '../../../src/core.js';

describe('emitter', () => {
  test('emit and on', () => {
    const emitter = new Emitter();

    let received: unknown;
    emitter.on('abc', (data) => {
      received = data;
    });
    emitter.emit('abc', { hello: 'world' });

    expect(received).toEqual({ hello: 'world' });
  });

  test('listenDOM', () => {
    const editor = new Lextrix(document.createElement('div'));
    document.body.appendChild(editor.container);

    let calls = 0;
    editor.emitter.listenDOM('click', document.body, () => {
      calls += 1;
    });

    document.body.click();
    expect(calls).toEqual(1);

    editor.container.remove();
    document.body.click();
    expect(calls).toEqual(1);

    document.body.appendChild(editor.container);
    document.body.click();
    expect(calls).toEqual(2);
  });
});
