/** Lextrix modules — editor behavior modules. */
import type Lextrix from 'lextrix-core';
import { lxrPath } from 'lextrix-core/registry-paths.js';

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

export function registerCoreModules(editor: typeof Lextrix, overwrite = false) {
  editor.register(
    {
      [lxrPath.module('clipboard')]: Clipboard,
      [lxrPath.module('history')]: History,
      [lxrPath.module('keyboard')]: Keyboard,
      [lxrPath.module('uploader')]: Uploader,
      [lxrPath.module('input')]: Input,
      [lxrPath.module('uiNode')]: UINode,
    },
    overwrite,
  );
}

export function registerOptionalModules(
  editor: typeof Lextrix,
  overwrite = false,
) {
  editor.register(
    {
      [lxrPath.module('imageResize')]: ImageResize,
      [lxrPath.module('syntax')]: Syntax,
      [lxrPath.module('table')]: Table,
      [lxrPath.module('toolbar')]: Toolbar,
    },
    overwrite,
  );
}

export function registerModules(editor: typeof Lextrix, overwrite = false) {
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
