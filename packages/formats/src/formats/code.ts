import Block from 'lextrix-core/blots/block.js';
import Break from 'lextrix-core/blots/break.js';
import Cursor from 'lextrix-core/blots/cursor.js';
import TextBlot, { escapeText } from 'lextrix-core/blots/text.js';
import Container from 'lextrix-core/blots/container.js';
import Lextrix from 'lextrix-core';
import { defineDocumentFormat } from '../format-definition.js';
import { defineInlineTagFormat } from '../inline-format.js';
import { registerFormatGroup } from '../block-format.js';

class CodeBlockContainer extends Container {
  static create(value: string) {
    const domNode = super.create(value) as Element;
    domNode.setAttribute('spellcheck', 'false');
    return domNode;
  }

  code(index: number, length: number) {
    return (
      this.children
        // @ts-expect-error
        .map((child) => (child.length() <= 1 ? '' : child.domNode.innerText))
        .join('\n')
        .slice(index, index + length)
    );
  }

  html(index: number, length: number) {
    return `<pre>\n${escapeText(this.code(index, length))}\n</pre>`;
  }
}

class CodeBlock extends Block {
  static TAB = '  ';

  static register() {
    Lextrix.register(CodeBlockContainer);
  }
}

const Code = defineInlineTagFormat({
  blotName: 'code',
  tagName: 'CODE',
});

CodeBlock.blotName = 'code-block';
CodeBlock.className = 'lxr-code-block';
CodeBlock.tagName = 'DIV';
CodeBlockContainer.blotName = 'code-block-container';
CodeBlockContainer.className = 'lxr-code-block-container';
CodeBlockContainer.tagName = 'DIV';

CodeBlockContainer.allowedChildren = [CodeBlock];
CodeBlock.allowedChildren = [TextBlot, Break, Cursor];
CodeBlock.requiredContainer = CodeBlockContainer;

defineDocumentFormat(CodeBlockContainer, {
  className: CodeBlockContainer.className,
});
defineDocumentFormat(CodeBlock, {
  className: CodeBlock.className,
});

registerFormatGroup('code-block', [Code, CodeBlock, CodeBlockContainer]);

export { Code, CodeBlockContainer, CodeBlock as default };
