# Format author guide

Built-in formats live in `lextrix-formats`. Custom formats register a blot class and optional attributor metadata.

## Inline tag format

For simple tag-based inline formats (bold, italic, custom spans):

```javascript
import { defineInlineTagFormat } from 'lextrix-formats/inline-format.js';

export const Highlight = defineInlineTagFormat({
  blotName: 'highlight',
  tagName: 'MARK',
});
```

Register with `Lextrix.register({ [lxrPath.format('highlight')]: Highlight })`.

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

Attributors are indexed in `FormatDefinitionCatalog`. `AttributorStore` resolves from the catalog before querying the scroll registry.

## Format metadata hooks

`defineDocumentFormat` attaches Lextrix-native metadata to a blot class:

| Hook | When it runs |
|------|--------------|
| `optimize` | Early in the optimize pass |
| `postOptimize` | After structure enforcement |

See `packages/dom/src/dom/format/format-definition.ts`.

## Scope

Formats declare a **Scope** bitmask (block, inline, attribute, embed). Use the scope matching how the format applies in the document tree.

## Checklist

1. Define blot or attributor helper
2. Register with `lxrPath.format()` or attributor group
3. Add format name to toolbar/config if user-facing
4. Add tests under `packages/lextrix/test/unit/formats/` or package-level tests

## Further reading

- [Custom embeds](./custom-embeds.md)
- [Registry guide](./registry.md)
- [Architecture — Format system](../architecture/overview.md#format-system)
- Examples: `packages/formats/src/formats/bold.ts`, `align.ts`, `blockquote.ts`
