import type Lextrix from 'lextrix-core';
import { lxrPath } from 'lextrix-core/registry-paths.js';

import Icons from './ui/icons.js';
import Picker from './ui/picker.js';
import ColorPicker from './ui/color-picker.js';
import IconPicker from './ui/icon-picker.js';
import Tooltip from './ui/tooltip.js';

export function registerUI(editor: typeof Lextrix, overwrite = false) {
  editor.register(
    {
      [lxrPath.ui('icons')]: Icons,
      [lxrPath.ui('picker')]: Picker,
      [lxrPath.ui('icon-picker')]: IconPicker,
      [lxrPath.ui('color-picker')]: ColorPicker,
      [lxrPath.ui('tooltip')]: Tooltip,
    },
    overwrite,
  );
}

export { ColorPicker, IconPicker, Icons, Picker, Tooltip };
