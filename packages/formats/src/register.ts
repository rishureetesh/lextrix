/** Lextrix formats — built-in text and block formats. */
import type Lextrix from 'lextrix-core';
import { lxrPath } from 'lextrix-core/registry-paths.js';

import { AlignClass, AlignStyle } from './formats/align.js';
import {
  DirectionAttribute,
  DirectionClass,
  DirectionStyle,
} from './formats/direction.js';
import Indent from './formats/indent.js';
import Blockquote from './formats/blockquote.js';
import Header from './formats/header.js';
import List from './formats/list.js';
import { BackgroundClass, BackgroundStyle } from './formats/background.js';
import { ColorClass, ColorStyle } from './formats/color.js';
import { FontClass, FontStyle } from './formats/font.js';
import { SizeClass, SizeStyle } from './formats/size.js';
import Bold from './formats/bold.js';
import Italic from './formats/italic.js';
import Link from './formats/link.js';
import Script from './formats/script.js';
import Strike from './formats/strike.js';
import Underline from './formats/underline.js';
import Formula from './formats/formula.js';
import Image from './formats/image.js';
import Video from './formats/video.js';
import CodeBlock, { Code as InlineCode } from './formats/code.js';

export function registerFormats(editor: typeof Lextrix, overwrite = false) {
  editor.register(
    {
      [lxrPath.attributor('attribute', 'direction')]: DirectionAttribute,
      [lxrPath.attributor('class', 'align')]: AlignClass,
      [lxrPath.attributor('class', 'background')]: BackgroundClass,
      [lxrPath.attributor('class', 'color')]: ColorClass,
      [lxrPath.attributor('class', 'direction')]: DirectionClass,
      [lxrPath.attributor('class', 'font')]: FontClass,
      [lxrPath.attributor('class', 'size')]: SizeClass,
      [lxrPath.attributor('style', 'align')]: AlignStyle,
      [lxrPath.attributor('style', 'background')]: BackgroundStyle,
      [lxrPath.attributor('style', 'color')]: ColorStyle,
      [lxrPath.attributor('style', 'direction')]: DirectionStyle,
      [lxrPath.attributor('style', 'font')]: FontStyle,
      [lxrPath.attributor('style', 'size')]: SizeStyle,
    },
    overwrite,
  );

  editor.register(
    {
      [lxrPath.format('align')]: AlignClass,
      [lxrPath.format('direction')]: DirectionClass,
      [lxrPath.format('indent')]: Indent,
      [lxrPath.format('background')]: BackgroundStyle,
      [lxrPath.format('color')]: ColorStyle,
      [lxrPath.format('font')]: FontClass,
      [lxrPath.format('size')]: SizeClass,
      [lxrPath.format('blockquote')]: Blockquote,
      [lxrPath.format('code-block')]: CodeBlock,
      [lxrPath.format('header')]: Header,
      [lxrPath.format('list')]: List,
      [lxrPath.format('bold')]: Bold,
      [lxrPath.format('code')]: InlineCode,
      [lxrPath.format('italic')]: Italic,
      [lxrPath.format('link')]: Link,
      [lxrPath.format('script')]: Script,
      [lxrPath.format('strike')]: Strike,
      [lxrPath.format('underline')]: Underline,
      [lxrPath.format('formula')]: Formula,
      [lxrPath.format('image')]: Image,
      [lxrPath.format('video')]: Video,
    },
    overwrite,
  );
}

export {
  AlignClass,
  AlignStyle,
  BackgroundClass,
  BackgroundStyle,
  Blockquote,
  Bold,
  CodeBlock,
  InlineCode,
  ColorClass,
  ColorStyle,
  DirectionAttribute,
  DirectionClass,
  DirectionStyle,
  FontClass,
  FontStyle,
  Formula,
  Header,
  Image,
  Indent,
  Italic,
  Link,
  List,
  Script,
  SizeClass,
  SizeStyle,
  Strike,
  Underline,
  Video,
};
