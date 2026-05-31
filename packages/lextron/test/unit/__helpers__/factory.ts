import { Registry } from 'lextron-dom';
import type { Attributor } from 'lextron-dom';

import Block from 'lextron-core/blots/block.js';
import Break from 'lextron-core/blots/break.js';
import Cursor from 'lextron-core/blots/cursor.js';
import Scroll from 'lextron-core/blots/scroll.js';
import TextBlot from 'lextron-core/blots/text.js';
import ListItem, { ListContainer } from 'lextron-formats/formats/list.js';
import Inline from 'lextron-core/blots/inline.js';
import Emitter from 'lextron-core/core/emitter.js';
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
