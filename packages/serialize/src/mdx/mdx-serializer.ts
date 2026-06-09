import type { ContentSerializer, SerializerFactory } from '../types.js';
import { validateMarkdownExport } from '../safety.js';
import { changeSetToMdx } from './emit.js';
import { mdxToChangeSet } from './parse.js';
import type { MdxComponentRegistry } from './component-registry.js';
import { getGlobalMdxComponentRegistry } from './component-registry.js';

export interface MdxSerializerOptions {
  componentRegistry?: MdxComponentRegistry;
}

/** MDX serializer — extends markdown with JSX component extension points. */
export function mdxSerializer(
  options: Partial<MdxSerializerOptions> = {},
): ContentSerializer {
  const registry = options.componentRegistry ?? getGlobalMdxComponentRegistry();

  return {
    format: 'mdx',
    extends: ['markdown'],

    import(content, context) {
      return mdxToChangeSet(content, context, registry);
    },

    export(changeSet, context) {
      validateMarkdownExport(changeSet);
      return changeSetToMdx(changeSet, context, registry);
    },
  };
}

export const createMdxSerializer: SerializerFactory<MdxSerializerOptions> =
  mdxSerializer;
