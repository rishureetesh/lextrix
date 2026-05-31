/** Lextron core — document editor shell. */
import type Lextron from './core/lextron.js';
import { lxtPath } from './registry-paths.js';
import Block, { BlockEmbed } from './blots/block.js';
import Break from './blots/break.js';
import Container from './blots/container.js';
import Cursor from './blots/cursor.js';
import Embed from './blots/embed.js';
import Inline from './blots/inline.js';
import Scroll from './blots/scroll.js';
import TextBlot from './blots/text.js';

export function registerBlots(editor: typeof Lextron, overwrite = false) {
  editor.register(
    {
      [lxtPath.blot('block')]: Block,
      [lxtPath.blot('block/embed')]: BlockEmbed,
      [lxtPath.blot('break')]: Break,
      [lxtPath.blot('container')]: Container,
      [lxtPath.blot('cursor')]: Cursor,
      [lxtPath.blot('embed')]: Embed,
      [lxtPath.blot('inline')]: Inline,
      [lxtPath.blot('scroll')]: Scroll,
      [lxtPath.blot('text')]: TextBlot,
    },
    overwrite,
  );
}
