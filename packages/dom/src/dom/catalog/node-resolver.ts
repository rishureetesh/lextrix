import Scope from '../scope.js';
import { categoryFromScope } from '../format/format-level.js';
import type { BlotConstructor } from '../blot/abstract/blot.js';
import type { RegistryDefinition } from '../registry.js';
import type { DefinitionCatalog } from './definition-catalog.js';

/** Resolves DOM nodes and logical names to registered definitions. */
export class NodeResolver {
  constructor(private readonly catalog: DefinitionCatalog) {}

  resolve(
    query: string | Node | Scope,
    scope: Scope = Scope.ANY,
  ): RegistryDefinition | null {
    let match: RegistryDefinition | undefined;

    if (typeof query === 'string') {
      match = this.catalog.lookupByName(query);
    } else if (typeof query === 'number') {
      if (query & Scope.LEVEL & Scope.BLOCK) {
        match = this.catalog.byKey.get('block') as BlotConstructor | undefined;
      } else if (query & Scope.LEVEL & Scope.INLINE) {
        match = this.catalog.byKey.get('inline') as BlotConstructor | undefined;
      }
    } else if (query instanceof Text || query.nodeType === Node.TEXT_NODE) {
      match = this.catalog.byKey.get('text') as BlotConstructor | undefined;
    } else if (query instanceof Element) {
      const classNames = (query.getAttribute('class') || '').split(/\s+/);
      for (const name of classNames) {
        match = this.catalog.classes.get(name);
        if (match) break;
      }
      match = match ?? this.catalog.tags.get(query.tagName);
    }

    if (!match || !('scope' in match)) {
      return match ?? null;
    }

    if (scope === Scope.ANY) {
      return match;
    }

    const category = categoryFromScope(match.scope);
    const queryCategory = categoryFromScope(scope);
    if (
      category &&
      queryCategory &&
      category.level === queryCategory.level &&
      category.kind === queryCategory.kind
    ) {
      return match;
    }

    if (scope & Scope.LEVEL & match.scope && scope & Scope.TYPE & match.scope) {
      return match;
    }
    return null;
  }
}
