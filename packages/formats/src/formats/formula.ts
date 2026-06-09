/** Lextrix formats � built-in text and block formats. */
import Embed from 'lextrix-core/blots/embed.js';

class Formula extends Embed {
  static blotName = 'formula';
  static className = 'lxr-formula';
  static tagName = 'SPAN';

  static create(value: string) {
    const node = super.create(value) as Element;
    if (typeof value === 'string') {
      node.setAttribute('data-value', value);
      // @ts-expect-error optional peer — render when KaTeX is loaded
      if (window.katex != null) {
        // @ts-expect-error
        window.katex.render(value, node, {
          throwOnError: false,
          errorColor: '#f00',
        });
      } else {
        node.textContent = value;
        node.classList.add('lxr-formula-fallback');
      }
    }
    return node;
  }

  static value(domNode: Element) {
    return domNode.getAttribute('data-value');
  }

  html() {
    const { formula } = this.value();
    return `<span>${formula}</span>`;
  }
}

export default Formula;
