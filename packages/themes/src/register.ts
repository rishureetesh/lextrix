import type Lextron from 'lextron-core';
import { lxtPath } from 'lextron-core/registry-paths.js';

import BubbleTheme from './themes/bubble.js';
import DawnTheme from './themes/dawn.js';
import SlateTheme from './themes/slate.js';
import SnowTheme from './themes/snow.js';

export function registerThemes(editor: typeof Lextron, overwrite = false) {
  editor.register(
    {
      [lxtPath.theme('bubble')]: BubbleTheme,
      [lxtPath.theme('dawn')]: DawnTheme,
      [lxtPath.theme('slate')]: SlateTheme,
      [lxtPath.theme('snow')]: SnowTheme,
    },
    overwrite,
  );
}

export { default as BaseTheme, BaseTooltip } from './themes/base.js';
export { BubbleTheme, DawnTheme, SlateTheme, SnowTheme };
