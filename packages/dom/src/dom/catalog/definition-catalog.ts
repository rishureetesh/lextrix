import type Attributor from '../attributor/attributor.js';
import type { BlotConstructor } from '../blot/abstract/blot.js';
import type { RegistryDefinition } from '../registry.js';

/** Indexed store of registered node and attribute definitions. */
export class DefinitionCatalog {
  readonly byKey = new Map<string, RegistryDefinition>();
  readonly attributes = new Map<string, Attributor>();
  readonly classes = new Map<string, BlotConstructor>();
  readonly tags = new Map<string, BlotConstructor>();

  add(definition: RegistryDefinition): RegistryDefinition {
    const isBlot = 'blotName' in definition;
    const isAttr = 'attrName' in definition;

    const key = isBlot
      ? definition.blotName
      : isAttr
        ? definition.attrName
        : '';

    this.byKey.set(key, definition);

    if (isAttr && typeof definition.keyName === 'string') {
      this.attributes.set(definition.keyName, definition);
    }

    if (isBlot) {
      if (definition.className) {
        this.classes.set(definition.className, definition);
      }
      const tags = Array.isArray(definition.tagName)
        ? definition.tagName.map((t) => t.toUpperCase())
        : definition.tagName
          ? [definition.tagName.toUpperCase()]
          : [];
      for (const tag of tags) {
        if (!this.tags.has(tag) || !definition.className) {
          this.tags.set(tag, definition);
        }
      }
    }

    return definition;
  }

  lookupByName(name: string): RegistryDefinition | undefined {
    return this.byKey.get(name) ?? this.attributes.get(name);
  }
}
