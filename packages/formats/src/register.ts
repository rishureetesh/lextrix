/** Lextron formats — built-in text and block formats. */
import type Lextron from 'lextron-core';
import { lxtPath } from 'lextron-core/registry-paths.js';

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

export function registerFormats(editor: typeof Lextron, overwrite = false) {
  editor.register(
    {
      [lxtPath.attributor('attribute', 'direction')]: DirectionAttribute,
      [lxtPath.attributor('class', 'align')]: AlignClass,
      [lxtPath.attributor('class', 'background')]: BackgroundClass,
      [lxtPath.attributor('class', 'color')]: ColorClass,
      [lxtPath.attributor('class', 'direction')]: DirectionClass,
      [lxtPath.attributor('class', 'font')]: FontClass,
      [lxtPath.attributor('class', 'size')]: SizeClass,
      [lxtPath.attributor('style', 'align')]: AlignStyle,
      [lxtPath.attributor('style', 'background')]: BackgroundStyle,
      [lxtPath.attributor('style', 'color')]: ColorStyle,
      [lxtPath.attributor('style', 'direction')]: DirectionStyle,
      [lxtPath.attributor('style', 'font')]: FontStyle,
      [lxtPath.attributor('style', 'size')]: SizeStyle,
    },
    overwrite,
  );

  editor.register(
    {
      [lxtPath.format('align')]: AlignClass,
      [lxtPath.format('direction')]: DirectionClass,
      [lxtPath.format('indent')]: Indent,
      [lxtPath.format('background')]: BackgroundStyle,
      [lxtPath.format('color')]: ColorStyle,
      [lxtPath.format('font')]: FontClass,
      [lxtPath.format('size')]: SizeClass,
      [lxtPath.format('blockquote')]: Blockquote,
      [lxtPath.format('code-block')]: CodeBlock,
      [lxtPath.format('header')]: Header,
      [lxtPath.format('list')]: List,
      [lxtPath.format('bold')]: Bold,
      [lxtPath.format('code')]: InlineCode,
      [lxtPath.format('italic')]: Italic,
      [lxtPath.format('link')]: Link,
      [lxtPath.format('script')]: Script,
      [lxtPath.format('strike')]: Strike,
      [lxtPath.format('underline')]: Underline,
      [lxtPath.format('formula')]: Formula,
      [lxtPath.format('image')]: Image,
      [lxtPath.format('video')]: Video,
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
