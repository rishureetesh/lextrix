import Lextrix, { Dom, Range, registerBlots } from 'lextrix-core';
import { registerFormats } from 'lextrix-formats';
import { registerModules } from 'lextrix-modules';
import { registerUI } from 'lextrix-ui';
import { registerThemes } from 'lextrix-themes';
import {
  ChangeAttributes,
  ChangeIterator,
  ChangeOp,
  ChangeSet,
} from 'lextrix-change';

export { default as Module } from 'lextrix-core/core/module.js';
export type {
  Bounds,
  DebugLevel,
  EmitterSource,
  ExpandedLextrixOptions,
  LextrixOptions,
  ContentSerializer,
  ExportInput,
  ExportOptions,
  SerializeFormat,
  SerializerAdapter,
  SerializerContext,
  MdxComponentHandler,
  MdxComponentNode,
  MdxSerializerOptions,
  HtmlSerializerOptions,
} from 'lextrix-core';
export {
  SerializerHost,
  SerializerRegistry,
  MdxComponentRegistry,
  registerSerializer,
  unregisterSerializer,
  getGlobalSerializerRegistry,
  registerMdxComponent,
  getGlobalMdxComponentRegistry,
  createDefaultSerializers,
  createSerializerRegistry,
  jsonSerializer,
  htmlSerializer,
  markdownSerializer,
  mdxSerializer,
} from 'lextrix-core';
export { ChangeAttributes, ChangeIterator, ChangeOp, ChangeSet, Dom, Range };

registerBlots(Lextrix);
registerFormats(Lextrix, true);
registerModules(Lextrix, true);
registerUI(Lextrix, true);
registerThemes(Lextrix, true);

export default Lextrix;
