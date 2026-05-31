/** Lextron formats — built-in text and block formats. */
import Block from 'lextron-core/blots/block.js';
import Break from 'lextron-core/blots/break.js';
import Cursor from 'lextron-core/blots/cursor.js';
import Inline from 'lextron-core/blots/inline.js';
import TextBlot, { escapeText } from 'lextron-core/blots/text.js';
import Container from 'lextron-core/blots/container.js';
import Lextron from 'lextron-core';

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
    // `\n`s are needed in order to support empty lines at the beginning and the end.
    // https://html.spec.whatwg.org/multipage/syntax.html#element-restrictions
    return `<pre>\n${escapeText(this.code(index, length))}\n</pre>`;
  }
}

class CodeBlock extends Block {
  static TAB = '  ';

  static register() {
    Lextron.register(CodeBlockContainer);
  }
}

class Code extends Inline {}
Code.blotName = 'code';
Code.tagName = 'CODE';

CodeBlock.blotName = 'code-block';
CodeBlock.className = 'lxt-code-block';
CodeBlock.tagName = 'DIV';
CodeBlockContainer.blotName = 'code-block-container';
CodeBlockContainer.className = 'lxt-code-block-container';
CodeBlockContainer.tagName = 'DIV';

CodeBlockContainer.allowedChildren = [CodeBlock];

CodeBlock.allowedChildren = [TextBlot, Break, Cursor];
CodeBlock.requiredContainer = CodeBlockContainer;

export { Code, CodeBlockContainer, CodeBlock as default };
