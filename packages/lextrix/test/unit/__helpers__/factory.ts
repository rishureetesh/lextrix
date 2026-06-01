import { Registry } from 'lextrix-dom';
import type { Attributor } from 'lextrix-dom';

import Block from 'lextrix-core/blots/block.js';
import Break from 'lextrix-core/blots/break.js';
import Cursor from 'lextrix-core/blots/cursor.js';
import Scroll from 'lextrix-core/blots/scroll.js';
import TextBlot from 'lextrix-core/blots/text.js';
import ListItem, { ListContainer } from 'lextrix-formats/formats/list.js';
import Inline from 'lextrix-core/blots/inline.js';
import Emitter from 'lextrix-core/core/emitter.js';
import { normalizeHTML } from './utils.js';

export const createRegistry = (formats: unknown[] = []) => {
  const registry = new Registry();

  formats.forEach((format) => {
    registry.register(format as Attributor);
  });
  registry.register(Block);
  registry.register(Break);
  registry.register(Cursor);
  registry.register(Inline);
  registry.register(Scroll);
  registry.register(TextBlot);
  registry.register(ListContainer);
  registry.register(ListItem);

  return registry;
};

export const createScroll = (
  html: string | { html: string },
  registry = createRegistry(),
  container = document.body,
) => {
  const emitter = new Emitter();
  const root = container.appendChild(document.createElement('div'));
  root.innerHTML = normalizeHTML(html);
  const scroll = new Scroll(registry, root, {
    emitter,
  });
  return scroll;
};
