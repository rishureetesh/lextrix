import { assertType, expectTypeOf } from 'vitest';
import Lextrix, { ChangeSet } from '../../src/lextrix.js';
import type { Dom, EmitterSource, Range } from '../../src/lextrix.js';
import type { default as Block, BlockEmbed } from 'lextrix-core/blots/block.js';
import { lxrPath } from 'lextrix-core';
import { SnowTheme } from 'lextrix-themes';
import { LeafBlot } from 'lextrix-dom';

{
  const Counter = (lextrix: Lextrix, options: { unit: string }) => {
    console.log(lextrix, options);
  };
  Lextrix.register(lxrPath.module('counter'), Counter);
  Lextrix.register(lxrPath.theme('snow'), SnowTheme);
  Lextrix.register(lxrPath.theme('snow'), SnowTheme, true);

  class MyBlot extends LeafBlot {}

  Lextrix.register(MyBlot);
  Lextrix.register(MyBlot, true);
  // @ts-expect-error Theme classes must be registered with a path
  Lextrix.register(SnowTheme);
  Lextrix.register({
    [lxrPath.module('counter')]: Counter,
    [lxrPath.theme('snow')]: SnowTheme,
    [lxrPath.format('my-blot')]: MyBlot,
  });
  Lextrix.register(
    {
      [lxrPath.module('counter')]: Counter,
      [lxrPath.theme('snow')]: SnowTheme,
      [lxrPath.format('my-blot')]: MyBlot,
    },
    true,
  );
}

const lextrix = new Lextrix('#editor');

{
  lextrix.deleteText(0, 1);
  lextrix.deleteText(0, 1, 'api');
  lextrix.deleteText({ index: 0, length: 1 });
  lextrix.deleteText({ index: 0, length: 1 }, 'api');
}

{
  assertType<ChangeSet>(lextrix.getContents());
  assertType<ChangeSet>(lextrix.getContents(1));
  assertType<ChangeSet>(lextrix.getContents(1, 2));
}

{
  assertType<number>(lextrix.getLength());
}

{
  assertType<string>(lextrix.getSemanticHTML());
  assertType<string>(lextrix.getSemanticHTML(1));
  assertType<string>(lextrix.getSemanticHTML(1, 2));
}

{
  assertType<ChangeSet>(
    lextrix.insertEmbed(10, 'image', 'https://example.com/logo.png'),
  );
  assertType<ChangeSet>(
    lextrix.insertEmbed(10, 'image', 'https://example.com/logo.png', 'api'),
  );
}

{
  lextrix.insertText(0, 'Hello');
  lextrix.insertText(0, 'Hello', 'api');
  lextrix.insertText(0, 'Hello', 'bold', true);
  lextrix.insertText(0, 'Hello', 'bold', true, 'api');
  lextrix.insertText(5, 'Lextrix', {
    color: '#ffff00',
    italic: true,
  });
  lextrix.insertText(
    5,
    'Lextrix',
    {
      color: '#ffff00',
      italic: true,
    },
    'api',
  );
}

{
  lextrix.enable();
  lextrix.enable(true);
}

{
  lextrix.disable();
}

{
  assertType<boolean>(lextrix.editReadOnly(() => true));
  assertType<string>(lextrix.editReadOnly(() => 'success'));
}

{
  lextrix.setText('Hello World!');
  lextrix.setText('Hello World!', 'api');
}

{
  assertType<ChangeSet>(lextrix.updateContents([{ insert: 'Hello World!' }]));
  assertType<ChangeSet>(lextrix.updateContents([{ insert: 'Hello World!' }], 'api'));
  assertType<ChangeSet>(lextrix.updateContents(new ChangeSet().insert('Hello World!')));
  assertType<ChangeSet>(
    lextrix.updateContents(new ChangeSet().insert('Hello World!'), 'api'),
  );
}

{
  assertType<ChangeSet>(lextrix.setContents([{ insert: 'Hello World!\n' }]));
  assertType<ChangeSet>(lextrix.setContents([{ insert: 'Hello World!\n' }], 'api'));
  assertType<ChangeSet>(lextrix.setContents(new ChangeSet().insert('Hello World!\n')));
  assertType<ChangeSet>(
    lextrix.setContents(new ChangeSet().insert('Hello World!\n'), 'api'),
  );
}

{
  assertType<ChangeSet>(lextrix.format('bold', true));
  assertType<ChangeSet>(lextrix.format('bold', true, 'api'));
}

{
  lextrix.formatText(0, 1, 'bold', true);
  lextrix.formatText(0, 1, 'bold', true, 'api');
  lextrix.formatText(0, 5, {
    bold: false,
    color: 'rgb(0, 0, 255)',
  });
  lextrix.formatText(
    0,
    5,
    {
      bold: false,
      color: 'rgb(0, 0, 255)',
    },
    'api',
  );
}

{
  lextrix.formatLine(0, 1, 'bold', true);
  lextrix.formatLine(0, 1, 'bold', true, 'api');
  lextrix.formatLine(0, 5, {
    bold: false,
    color: 'rgb(0, 0, 255)',
  });
  lextrix.formatLine(
    0,
    5,
    {
      bold: false,
      color: 'rgb(0, 0, 255)',
    },
    'api',
  );
}

{
  lextrix.getFormat();
  lextrix.getFormat(1);
  lextrix.getFormat(1, 10);
  lextrix.getFormat({ index: 1, length: 1 });
}

{
  assertType<ChangeSet>(lextrix.removeFormat(3, 2));
  assertType<ChangeSet>(lextrix.removeFormat(3, 2, 'user'));
}

{
  lextrix.getBounds(3, 2);
}

{
  lextrix.getSelection();
  lextrix.getSelection(true);
}

{
  lextrix.setSelection(1, 2);
  lextrix.setSelection(1, 2, 'api');
  lextrix.setSelection({ index: 1, length: 2 });
  lextrix.setSelection({ index: 1, length: 2 }, 'api');
}

{
  lextrix.scrollSelectionIntoView();
  lextrix.scrollSelectionIntoView({ smooth: true });
}

{
  lextrix.blur();
}

{
  lextrix.focus();
}

{
  assertType<boolean>(lextrix.hasFocus());
}

{
  lextrix.update();
  lextrix.update('user');
}

{
  lextrix.scrollRectIntoView({ left: 0, right: 0, top: 0, bottom: 0 });
  lextrix.scrollRectIntoView(
    document.createElement('div').getBoundingClientRect(),
  );
  lextrix.scrollRectIntoView(
    document.createElement('div').getBoundingClientRect(),
    { smooth: true },
  );
}

{
  lextrix.on('text-change', (changeSet, oldChangeSet, source) => {
    expectTypeOf<ChangeSet>(changeSet);
    expectTypeOf<ChangeSet>(oldChangeSet);
    expectTypeOf<EmitterSource>(source);
  });
}

{
  lextrix.on('selection-change', (range, oldRange, source) => {
    expectTypeOf<Range>(range);
    expectTypeOf<Range>(oldRange);
    expectTypeOf<EmitterSource>(source);
  });
}

{
  assertType<[Dom.LeafBlot | null, number]>(lextrix.getLeaf(0));
}

{
  assertType<[BlockEmbed | Block | null, number]>(lextrix.getLine(0));
}

{
  assertType<(BlockEmbed | Block)[]>(lextrix.getLines(0));
  assertType<(BlockEmbed | Block)[]>(lextrix.getLines(0, 10));
}
