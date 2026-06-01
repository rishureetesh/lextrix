/** Lextrix modules — editor behavior modules. */
import ChangeSet from 'lextrix-change';
import type Lextrix from 'lextrix-core';
import Emitter from 'lextrix-core/core/emitter.js';
import Module from 'lextrix-core/core/module.js';
import type { Range } from 'lextrix-core/core/selection.js';

interface UploaderOptions {
  mimetypes: string[];
  handler: (this: { lextrix: Lextrix }, range: Range, files: File[]) => void;
}

class Uploader extends Module<UploaderOptions> {
  static DEFAULTS: UploaderOptions;

  constructor(lextrix: Lextrix, options: Partial<UploaderOptions>) {
    super(lextrix, options);
    lextrix.root.addEventListener('drop', (e) => {
      e.preventDefault();
      let native: ReturnType<typeof document.createRange> | null = null;
      if (document.caretRangeFromPoint) {
        native = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (document.caretPositionFromPoint) {
        const position = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (position) {
          native = document.createRange();
          native.setStart(position.offsetNode, position.offset);
          native.setEnd(position.offsetNode, position.offset);
        }
      }

      const normalized = native && lextrix.selection.normalizeNative(native);
      if (normalized) {
        const range = lextrix.selection.normalizedToRange(normalized);
        if (e.dataTransfer?.files) {
          this.upload(range, e.dataTransfer.files);
        }
      }
    });
  }

  upload(range: Range, files: FileList | File[]) {
    const uploads: File[] = [];
    Array.from(files).forEach((file) => {
      if (file && this.options.mimetypes?.includes(file.type)) {
        uploads.push(file);
      }
    });
    if (uploads.length > 0) {
      // @ts-expect-error Fix me later
      this.options.handler.call(this, range, uploads);
    }
  }
}

Uploader.DEFAULTS = {
  mimetypes: ['image/png', 'image/jpeg'],
  handler(range: Range, files: File[]) {
    if (!this.lextrix.scroll.query('image')) {
      return;
    }
    const promises = files.map<Promise<string>>((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(promises).then((images) => {
      const update = images.reduce((delta: ChangeSet, image) => {
        return delta.insert({ image });
      }, new ChangeSet().retain(range.index).delete(range.length)) as ChangeSet;
      this.lextrix.updateContents(update, Emitter.sources.USER);
      this.lextrix.setSelection(
        range.index + images.length,
        Emitter.sources.SILENT,
      );
    });
  },
};

export default Uploader;
