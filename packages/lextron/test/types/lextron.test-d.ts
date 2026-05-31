import { assertType, expectTypeOf } from 'vitest';
import Lextron, { ChangeSet } from '../../src/lextron.js';
import type { Dom, EmitterSource, Range } from '../../src/lextron.js';
import type { default as Block, BlockEmbed } from 'lextron-core/blots/block.js';
import { lxtPath } from 'lextron-core';
import { SnowTheme } from 'lextron-themes';
import { LeafBlot } from 'lextron-dom';

{
  const Counter = (lextron: Lextron, options: { unit: string }) => {
    console.log(lextron, options);
  };
  Lextron.register(lxtPath.module('counter'), Counter);
  Lextron.register(lxtPath.theme('snow'), SnowTheme);
  Lextron.register(lxtPath.theme('snow'), SnowTheme, true);

  class MyBlot extends LeafBlot {}

  Lextron.register(MyBlot);
  Lextron.register(MyBlot, true);
  // @ts-expect-error Theme classes must be registered with a path
  Lextron.register(SnowTheme);
  Lextron.register({
    [lxtPath.module('counter')]: Counter,
    [lxtPath.theme('snow')]: SnowTheme,
    [lxtPath.format('my-blot')]: MyBlot,
  });
  Lextron.register(
    {
      [lxtPath.module('counter')]: Counter,
      [lxtPath.theme('snow')]: SnowTheme,
      [lxtPath.format('my-blot')]: MyBlot,
    },
    true,
  );
}

const lextron = new Lextron('#editor');

{
  lextron.deleteText(0, 1);
  lextron.deleteText(0, 1, 'api');
  lextron.deleteText({ index: 0, length: 1 });
  lextron.deleteText({ index: 0, length: 1 }, 'api');
}

{
  assertType<ChangeSet>(lextron.getContents());
  assertType<ChangeSet>(lextron.getContents(1));
  assertType<ChangeSet>(lextron.getContents(1, 2));
}

{
  assertType<number>(lextron.getLength());
}

{
  assertType<string>(lextron.getSemanticHTML());
  assertType<string>(lextron.getSemanticHTML(1));
  assertType<string>(lextron.getSemanticHTML(1, 2));
}

{
  assertType<ChangeSet>(
    lextron.insertEmbed(10, 'image', 'https://example.com/logo.png'),
  );
  assertType<ChangeSet>(
    lextron.insertEmbed(10, 'image', 'https://example.com/logo.png', 'api'),
  );
}

{
  lextron.insertText(0, 'Hello');
  lextron.insertText(0, 'Hello', 'api');
  lextron.insertText(0, 'Hello', 'bold', true);
  lextron.insertText(0, 'Hello', 'bold', true, 'api');
  lextron.insertText(5, 'Lextron', {
    color: '#ffff00',
    italic: true,
  });
  lextron.insertText(
    5,
    'Lextron',
    {
      color: '#ffff00',
      italic: true,
    },
    'api',
  );
}

{
  lextron.enable();
  lextron.enable(true);
}

{
  lextron.disable();
}

{
  assertType<boolean>(lextron.editReadOnly(() => true));
  assertType<string>(lextron.editReadOnly(() => 'success'));
}

{
  lextron.setText('Hello World!');
  lextron.setText('Hello World!', 'api');
}

{
  assertType<ChangeSet>(lextron.updateContents([{ insert: 'Hello World!' }]));
  assertType<ChangeSet>(lextron.updateContents([{ insert: 'Hello World!' }], 'api'));
  assertType<ChangeSet>(lextron.updateContents(new ChangeSet().insert('Hello World!')));
  assertType<ChangeSet>(
    lextron.updateContents(new ChangeSet().insert('Hello World!'), 'api'),
  );
}

{
  assertType<ChangeSet>(lextron.setContents([{ insert: 'Hello World!\n' }]));
  assertType<ChangeSet>(lextron.setContents([{ insert: 'Hello World!\n' }], 'api'));
  assertType<ChangeSet>(lextron.setContents(new ChangeSet().insert('Hello World!\n')));
  assertType<ChangeSet>(
    lextron.setContents(new ChangeSet().insert('Hello World!\n'), 'api'),
  );
}

{
  assertType<ChangeSet>(lextron.format('bold', true));
  assertType<ChangeSet>(lextron.format('bold', true, 'api'));
}

{
  lextron.formatText(0, 1, 'bold', true);
  lextron.formatText(0, 1, 'bold', true, 'api');
  lextron.formatText(0, 5, {
    bold: false,
    color: 'rgb(0, 0, 255)',
  });
  lextron.formatText(
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
  lextron.formatLine(0, 1, 'bold', true);
  lextron.formatLine(0, 1, 'bold', true, 'api');
  lextron.formatLine(0, 5, {
    bold: false,
    color: 'rgb(0, 0, 255)',
  });
  lextron.formatLine(
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
  lextron.getFormat();
  lextron.getFormat(1);
  lextron.getFormat(1, 10);
  lextron.getFormat({ index: 1, length: 1 });
}

{
  assertType<ChangeSet>(lextron.removeFormat(3, 2));
  assertType<ChangeSet>(lextron.removeFormat(3, 2, 'user'));
}

{
  lextron.getBounds(3, 2);
}

{
  lextron.getSelection();
  lextron.getSelection(true);
}

{
  lextron.setSelection(1, 2);
  lextron.setSelection(1, 2, 'api');
  lextron.setSelection({ index: 1, length: 2 });
  lextron.setSelection({ index: 1, length: 2 }, 'api');
}

{
  lextron.scrollSelectionIntoView();
  lextron.scrollSelectionIntoView({ smooth: true });
}

{
  lextron.blur();
}

{
  lextron.focus();
}

{
  assertType<boolean>(lextron.hasFocus());
}

{
  lextron.update();
  lextron.update('user');
}

{
  lextron.scrollRectIntoView({ left: 0, right: 0, top: 0, bottom: 0 });
  lextron.scrollRectIntoView(
    document.createElement('div').getBoundingClientRect(),
  );
  lextron.scrollRectIntoView(
    document.createElement('div').getBoundingClientRect(),
    { smooth: true },
  );
}

{
  lextron.on('text-change', (changeSet, oldChangeSet, source) => {
    expectTypeOf<ChangeSet>(changeSet);
    expectTypeOf<ChangeSet>(oldChangeSet);
    expectTypeOf<EmitterSource>(source);
  });
}

{
  lextron.on('selection-change', (range, oldRange, source) => {
    expectTypeOf<Range>(range);
    expectTypeOf<Range>(oldRange);
    expectTypeOf<EmitterSource>(source);
  });
}

{
  assertType<[Dom.LeafBlot | null, number]>(lextron.getLeaf(0));
}

{
  assertType<[BlockEmbed | Block | null, number]>(lextron.getLine(0));
}

{
  assertType<(BlockEmbed | Block)[]>(lextron.getLines(0));
  assertType<(BlockEmbed | Block)[]>(lextron.getLines(0, 10));
}
