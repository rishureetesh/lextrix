import type Lextron from 'lextron-core';
import { lxtPath } from 'lextron-core/registry-paths.js';

import Icons from './ui/icons.js';
import Picker from './ui/picker.js';
import ColorPicker from './ui/color-picker.js';
import IconPicker from './ui/icon-picker.js';
import Tooltip from './ui/tooltip.js';

export function registerUI(editor: typeof Lextron, overwrite = false) {
  editor.register(
    {
      [lxtPath.ui('icons')]: Icons,
      [lxtPath.ui('picker')]: Picker,
      [lxtPath.ui('icon-picker')]: IconPicker,
      [lxtPath.ui('color-picker')]: ColorPicker,
      [lxtPath.ui('tooltip')]: Tooltip,
    },
    overwrite,
  );
}

export { ColorPicker, IconPicker, Icons, Picker, Tooltip };
