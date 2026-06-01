import type { Blot, BlotConstructor } from '../blot/abstract/blot.js';
import type Attributor from '../attributor/attributor.js';
import Scope from '../scope.js';

/** Lextrix-native format metadata decoupled from blot class bodies. */
export interface DocumentFormatDefinition {
  name: string;
  scope: Scope;
  tagName?: string | string[];
  className?: string;
  /** Runs during ShadowBlot.optimize (early in the optimize pass). */
  optimize?: (blot: Blot, context: Record<string, unknown>) => void;
  /** Runs at end of ParentBlot.optimize (after structure enforcement). */
  postOptimize?: (blot: Blot, context: Record<string, unknown>) => void;
}

export interface AttributorFormatDefinition {
  name: string;
  scope: Scope;
  keyName: string;
}

export interface FormatGroupDefinition {
  name: string;
  blotNames: string[];
  attributorNames?: string[];
}

const definitionsByBlot = new WeakMap<BlotConstructor, DocumentFormatDefinition>();
const definitionsByName = new Map<string, DocumentFormatDefinition>();
const attributorsByName = new Map<string, Attributor[]>();
const allAttributors: Attributor[] = [];
const formatGroups = new Map<string, FormatGroupDefinition>();

function attributorKey(attributor: Attributor): string {
  return `${attributor.attrName}:${attributor.keyName}`;
}

/** Associates a blot class with Lextrix-native format metadata. */
export function defineDocumentFormat<T extends BlotConstructor>(
  blotClass: T,
  definition: Partial<DocumentFormatDefinition> & { name?: string },
): T {
  const full: DocumentFormatDefinition = {
    name: definition.name ?? blotClass.blotName,
    scope: definition.scope ?? blotClass.scope,
    tagName: definition.tagName ?? blotClass.tagName,
    className: definition.className ?? blotClass.className,
    optimize: definition.optimize,
    postOptimize: definition.postOptimize,
  };
  definitionsByBlot.set(blotClass, full);
  definitionsByName.set(full.name, full);
  return blotClass;
}

/** Registers an attributor in the format definition catalog. */
export function defineAttributorFormat<T extends Attributor>(attributor: T): T {
  const bucket = attributorsByName.get(attributor.attrName) ?? [];
  if (!bucket.some((entry) => attributorKey(entry) === attributorKey(attributor))) {
    bucket.push(attributor);
    attributorsByName.set(attributor.attrName, bucket);
    allAttributors.push(attributor);
  }
  return attributor;
}

export function getAttributorFormatDefinition(
  name: string,
): AttributorFormatDefinition | undefined {
  const match = getAttributorFormat(name);
  if (match == null) {
    return undefined;
  }
  return {
    name: match.attrName,
    scope: match.scope,
    keyName: match.keyName,
  };
}

export function getAttributorFormat(name: string): Attributor | undefined {
  const matches = attributorsByName.get(name);
  return matches?.[matches.length - 1];
}

/** Groups related attributors (align class/style, color class/style, …). */
export function defineAttributorGroup(
  name: string,
  attributors: Attributor[],
): FormatGroupDefinition {
  for (const attributor of attributors) {
    defineAttributorFormat(attributor);
  }
  const existing = formatGroups.get(name);
  const group: FormatGroupDefinition = {
    name,
    blotNames: existing?.blotNames ?? [],
    attributorNames: attributors.map((a) => a.keyName),
  };
  formatGroups.set(name, group);
  return group;
}

/** Groups related blot classes under one logical format (list, table, code, …). */
export function defineFormatGroup(
  name: string,
  blotClasses: BlotConstructor[],
): FormatGroupDefinition {
  const group: FormatGroupDefinition = {
    name,
    blotNames: blotClasses.map((c) => c.blotName),
  };
  formatGroups.set(name, group);
  for (const blotClass of blotClasses) {
    if (!definitionsByBlot.has(blotClass)) {
      defineDocumentFormat(blotClass, { name: blotClass.blotName });
    }
  }
  return group;
}

export function getDocumentFormatDefinition(
  blot: Blot,
): DocumentFormatDefinition | undefined {
  return definitionsByBlot.get(blot.constructor as BlotConstructor);
}

export function getFormatGroup(name: string): FormatGroupDefinition | undefined {
  return formatGroups.get(name);
}

/** Runs format-specific optimize hooks registered via defineDocumentFormat. */
export class FormatDefinitionCatalog {
  static runOptimize(blot: Blot, context: Record<string, unknown>): void {
    getDocumentFormatDefinition(blot)?.optimize?.(blot, context);
  }

  static runPostOptimize(blot: Blot, context: Record<string, unknown>): void {
    getDocumentFormatDefinition(blot)?.postOptimize?.(blot, context);
  }

  static list(): DocumentFormatDefinition[] {
    return [...definitionsByName.values()];
  }

  static listAttributors(): AttributorFormatDefinition[] {
    return allAttributors.map((attributor) => ({
      name: attributor.attrName,
      scope: attributor.scope,
      keyName: attributor.keyName,
    }));
  }

  static resolveAttributor(name: string, scope = Scope.ANY): Attributor | undefined {
    for (let i = allAttributors.length - 1; i >= 0; i -= 1) {
      const attributor = allAttributors[i]!;
      if (attributor.attrName !== name && attributor.keyName !== name) {
        continue;
      }
      if (scope === Scope.ANY || (attributor.scope & scope) !== 0) {
        return attributor;
      }
    }
    return undefined;
  }

  static groups(): FormatGroupDefinition[] {
    return [...formatGroups.values()];
  }
}

export default FormatDefinitionCatalog;
