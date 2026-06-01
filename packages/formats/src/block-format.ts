import Block from 'lextrix-core/blots/block.js';
import Container from 'lextrix-core/blots/container.js';
import type { BlotConstructor, Root } from 'lextrix-dom';
import { Scope } from 'lextrix-dom';
import {
  defineDocumentFormat,
  defineFormatGroup,
  type DocumentFormatDefinition,
} from './format-definition.js';

type BlockFormatConfig = {
  blotName: string;
  tagName: string | string[];
  className?: string;
  formats?: (domNode: Element) => unknown;
  create?: (value?: string) => HTMLElement;
  optimize?: DocumentFormatDefinition['optimize'];
  postOptimize?: DocumentFormatDefinition['postOptimize'];
};

/** Registers a block format blot + DocumentNode definition together. */
export function defineBlockFormat(config: BlockFormatConfig) {
  class FormatBlot extends Block {
    static blotName = config.blotName;
    static tagName = config.tagName;
    static scope = Scope.BLOCK_BLOT;

    static create(value?: unknown) {
      if (config.create) {
        return config.create(value as string | undefined);
      }
      return super.create() as HTMLElement;
    }

    static formats(domNode: HTMLElement, scroll: Root): any {
      if (config.formats) {
        return config.formats(domNode);
      }
      return super.formats(domNode, scroll);
    }
  }

  if (config.className != null) {
    FormatBlot.className = config.className;
  }

  defineDocumentFormat(FormatBlot as unknown as BlotConstructor, {
    tagName: config.tagName,
    className: config.className,
    optimize: config.optimize,
    postOptimize: config.postOptimize,
  });

  return FormatBlot as unknown as BlotConstructor;
}

type ContainerFormatConfig = {
  blotName: string;
  tagName: string | string[];
  className?: string;
  create?: (value?: string) => Element;
};

/** Registers a container blot + DocumentNode definition together. */
export function defineContainerFormat(config: ContainerFormatConfig) {
  class FormatBlot extends Container {
    static blotName = config.blotName;
    static tagName = config.tagName;
    static scope = Scope.BLOCK_BLOT;

    static create(value?: unknown) {
      if (config.create) {
        return config.create(value as string | undefined);
      }
      return super.create(value) as Element;
    }
  }

  if (config.className != null) {
    FormatBlot.className = config.className;
  }

  defineDocumentFormat(FormatBlot as unknown as BlotConstructor, {
    tagName: config.tagName,
    className: config.className,
  });

  return FormatBlot as unknown as BlotConstructor;
}

/** Registers a multi-blot format group (list, table, code-block, …). */
export function registerFormatGroup(
  groupName: string,
  blotClasses: BlotConstructor[],
): void {
  defineFormatGroup(groupName, blotClasses);
}

export default defineBlockFormat;
