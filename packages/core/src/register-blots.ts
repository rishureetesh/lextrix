/** Lextrix core — document editor shell. */
import type Lextrix from './core/lextrix.js';
import { lxrPath } from './registry-paths.js';
import Block, { BlockEmbed } from './blots/block.js';
import Break from './blots/break.js';
import Container from './blots/container.js';
import Cursor from './blots/cursor.js';
import Embed from './blots/embed.js';
import Inline from './blots/inline.js';
import Scroll from './blots/scroll.js';
import TextBlot from './blots/text.js';

export function registerBlots(editor: typeof Lextrix, overwrite = false) {
  editor.register(
    {
      [lxrPath.blot('block')]: Block,
      [lxrPath.blot('block/embed')]: BlockEmbed,
      [lxrPath.blot('break')]: Break,
      [lxrPath.blot('container')]: Container,
      [lxrPath.blot('cursor')]: Cursor,
      [lxrPath.blot('embed')]: Embed,
      [lxrPath.blot('inline')]: Inline,
      [lxrPath.blot('scroll')]: Scroll,
      [lxrPath.blot('text')]: TextBlot,
    },
    overwrite,
  );
}
