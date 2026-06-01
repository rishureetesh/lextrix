import {
  Attributor,
  ClassAttributor,
  Scope,
  StyleAttributor,
  defineAttributorFormat,
  defineAttributorGroup,
  type AttributorOptions,
} from 'lextrix-dom';

/** Registers a class attributor + format catalog metadata. */
export function defineClassAttributorFormat(
  name: string,
  className: string,
  options: AttributorOptions = {},
): ClassAttributor {
  return defineAttributorFormat(new ClassAttributor(name, className, options));
}

/** Registers a style attributor + format catalog metadata. */
export function defineStyleAttributorFormat(
  name: string,
  styleName: string,
  options: AttributorOptions = {},
): StyleAttributor {
  return defineAttributorFormat(new StyleAttributor(name, styleName, options));
}

/** Registers a DOM attribute attributor + format catalog metadata. */
export function defineAttributeAttributorFormat(
  name: string,
  attrName: string,
  options: AttributorOptions = {},
): Attributor {
  return defineAttributorFormat(new Attributor(name, attrName, options));
}

/** Registers a custom attributor subclass + format catalog metadata. */
export function registerAttributorFormat<T extends Attributor>(attributor: T): T {
  return defineAttributorFormat(attributor);
}

export { defineAttributorGroup, Scope };

export default defineClassAttributorFormat;
