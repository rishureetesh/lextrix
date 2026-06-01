# Custom embed guide

Embeds are non-text leaf nodes in the document (image, video, formula). They use **embed blots** and appear in ChangeSets as object inserts.

## ChangeSet shape

```json
{ "insert": { "image": "https://example.com/photo.png" } }
{ "insert": { "video": "https://www.youtube.com/embed/…" } }
{ "insert": { "formula": "E=mc^2" } }
```

Insert programmatically:

```javascript
editor.insertEmbed(index, 'image', url, 'user');
```

## Define an embed blot

Embed blots extend the embed base in `lextrix-core` / `lextrix-dom`. Study built-ins:

| Format | File |
|--------|------|
| Image | `packages/formats/src/formats/image.ts` |
| Video | `packages/formats/src/formats/video.ts` |
| Formula | `packages/formats/src/formats/formula.ts` |

Typical pattern:

1. Blot class with `static blotName`, `static tagName` (or custom `create`)
2. `static value(domNode)` and instance `format(name, value)` for attributes (width, height)
3. Register via `lxrPath.format('myEmbed')`
4. Register embed handler in change engine if diff/transform needs custom behavior (`packages/change/src/change/embed-handlers.ts`)

## Block vs inline embeds

| Kind | Behavior |
|------|----------|
| Inline embed | Single leaf in a line (image, formula) |
| Block embed | Own block row (video, divider-style blocks) |

Use the matching base class from the formats package helpers or existing embed blots.

## Clipboard and paste

The clipboard module converts HTML to ChangeSets. Custom embeds may need clipboard matchers if pasted HTML uses non-standard tags. See `packages/modules/src/modules/clipboard.ts`.

## Toolbar integration

Add a toolbar handler in your theme or module:

```javascript
modules: {
  toolbar: {
    handlers: {
      myEmbed() {
        const url = prompt('URL');
        const range = this.lextrix.getSelection(true);
        if (range) {
          this.lextrix.insertEmbed(range.index, 'myEmbed', url, 'user');
        }
      },
    },
  },
}
```

## Further reading

- [Format author guide](./formats.md)
- [ChangeSet guide](./change-set.md)
- [Configuration — image upload](./configuration.md#image-upload-to-your-api)
