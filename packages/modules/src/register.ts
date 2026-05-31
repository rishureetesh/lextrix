/** Lextron modules — editor behavior modules. */
import type Lextron from 'lextron-core';
import { lxtPath } from 'lextron-core/registry-paths.js';

import Clipboard from './modules/clipboard.js';
import History from './modules/history.js';
import Keyboard from './modules/keyboard.js';
import Uploader from './modules/uploader.js';
import Input from './modules/input.js';
import UINode from './modules/uiNode.js';
import ImageResize from './modules/imageResize.js';
import Syntax from './modules/syntax.js';
import Table from './modules/table.js';
import Toolbar from './modules/toolbar.js';

export function registerCoreModules(editor: typeof Lextron, overwrite = false) {
  editor.register(
    {
      [lxtPath.module('clipboard')]: Clipboard,
      [lxtPath.module('history')]: History,
      [lxtPath.module('keyboard')]: Keyboard,
      [lxtPath.module('uploader')]: Uploader,
      [lxtPath.module('input')]: Input,
      [lxtPath.module('uiNode')]: UINode,
    },
    overwrite,
  );
}

export function registerOptionalModules(
  editor: typeof Lextron,
  overwrite = false,
) {
  editor.register(
    {
      [lxtPath.module('imageResize')]: ImageResize,
      [lxtPath.module('syntax')]: Syntax,
      [lxtPath.module('table')]: Table,
      [lxtPath.module('toolbar')]: Toolbar,
    },
    overwrite,
  );
}

export function registerModules(editor: typeof Lextron, overwrite = false) {
  registerCoreModules(editor, overwrite);
  registerOptionalModules(editor, overwrite);
}

export {
  Clipboard,
  History,
  ImageResize,
  Input,
  Keyboard,
  Syntax,
  Table,
  Toolbar,
  UINode,
  Uploader,
};
export type { ToolbarConfig, ToolbarProps } from './modules/toolbar.js';
export type { ImageResizeOptions } from './modules/imageResize.js';
