# Formats

Built-in formats live in `lextrix-formats`. Custom formats register a blot class and optional attributor metadata.

## Registration

Extensions register through `Lextrix.register()` using `lxr/*` paths:

```javascript
import { lxrPath } from 'lextrix-core/registry-paths.js';

lxrPath.format('callout');           // lxr/formats/callout
lxrPath.module('mentions');          // lxr/modules/mentions
lxrPath.blot('scroll');              // lxr/blots/scroll
lxrPath.theme('snow');               // lxr/themes/snow
lxrPath.attributor('block', 'align'); // lxr/attributors/block/align
```

Bare paths like `formats/bold` or legacy keys like `parchment` throw at runtime.

```javascript
import Lextrix from 'lextrix';
import { lxrPath } from 'lextrix-core/registry-paths.js';

Lextrix.register({ [lxrPath.format('callout')]: CalloutBlot });
```

## Inline tag format

```javascript
import { defineInlineTagFormat } from 'lextrix-formats/inline-format.js';

export const Highlight = defineInlineTagFormat({
  blotName: 'highlight',
  tagName: 'MARK',
});

Lextrix.register({ [lxrPath.format('highlight')]: Highlight });
```

## Block format

```javascript
import { defineBlockFormat } from 'lextrix-formats/block-format.js';

export const Callout = defineBlockFormat({
  blotName: 'callout',
  tagName: 'DIV',
  className: 'lxr-callout',
});
```

## Attributor formats

For class, style, or attribute-based formatting (align, color, indent):

```javascript
import {
  defineClassAttributorFormat,
  defineAttributorGroup,
} from 'lextrix-formats/attributor-format.js';

const MarginClass = defineClassAttributorFormat('margin', 'lxr-margin', {
  scope: Scope.BLOCK,
  whitelist: ['small', 'large'],
});

defineAttributorGroup('margin', [MarginClass]);
```

## Embeds

Embeds are non-text leaf nodes (image, video, formula):

```json
{ "insert": { "image": "https://example.com/photo.png" } }
```

```javascript
editor.insertEmbed(index, 'image', url, 'user');
```

Define an embed blot extending the embed base. Study built-ins in `packages/formats/src/formats/image.ts`, `video.ts`, `formula.ts`.

| Kind | Behavior |
|------|----------|
| Inline embed | Single leaf in a line (image, formula) |
| Block embed | Own block row (video) |

Custom embeds may need clipboard matchers for non-standard pasted HTML. See `packages/modules/src/modules/clipboard.ts`.

## Format metadata hooks

`defineDocumentFormat` attaches Lextrix-native metadata to a blot class:

| Hook | When it runs |
|------|--------------|
| `optimize` | Early in the optimize pass |
| `postOptimize` | After structure enforcement |

## Scope

Formats declare a **Scope** bitmask (block, inline, attribute, embed).

## Examples

- `packages/formats/src/formats/bold.ts`, `align.ts`, `blockquote.ts`
- Tests: `packages/lextrix/test/unit/formats/`
