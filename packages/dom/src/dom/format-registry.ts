import type { Blot, Root } from './blot/abstract/blot.js';
import DomError from './error.js';
import { findBoundNode, nodeBindings } from './node-bindings.js';
import type { RegistryDefinition } from './registry-types.js';
import { DefinitionCatalog } from './catalog/definition-catalog.js';
import { NodeInstantiator } from './catalog/node-instantiator.js';
import { NodeResolver } from './catalog/node-resolver.js';
import Scope from './scope.js';
import type { RegistryInterface } from './registry-types.js';

/**
 * Composed format registry: catalog + resolver + instantiator.
 */
export class FormatRegistry implements RegistryInterface {
  static blots = nodeBindings;
  static find = findBoundNode;

  private readonly catalog = new DefinitionCatalog();
  private readonly resolver = new NodeResolver(this.catalog);
  private readonly instantiator = new NodeInstantiator();

  create(scroll: Root, input: Node | string | Scope, value?: unknown): Blot {
    const match = this.query(input);
    return this.instantiator.createFromQuery(scroll, match, input as Node | string, value);
  }

  find(node: Node | null, bubble = false): Blot | null {
    return findBoundNode(node, bubble);
  }

  query(
    query: string | Node | Scope,
    scope: Scope = Scope.ANY,
  ): RegistryDefinition | null {
    return this.resolver.resolve(query, scope);
  }

  register(...definitions: RegistryDefinition[]): RegistryDefinition[] {
    return definitions.map((definition) => {
      const isBlot = 'blotName' in definition;
      const isAttr = 'attrName' in definition;
      if (!isBlot && !isAttr) {
        throw new DomError('Invalid definition');
      }
      if (isBlot && definition.blotName === 'abstract') {
        throw new DomError('Cannot register abstract class');
      }
      return this.catalog.add(definition);
    });
  }
}

export default FormatRegistry;
