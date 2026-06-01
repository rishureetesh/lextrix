import Block from 'lextrix-core/blots/block.js';
import { defineDocumentFormat } from '../format-definition.js';

class Header extends Block {
  static blotName = 'header';
  static tagName = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

  static formats(domNode: Element) {
    return Header.tagName.indexOf(domNode.tagName) + 1;
  }
}

defineDocumentFormat(Header, {
  tagName: Header.tagName,
});

export default Header;
