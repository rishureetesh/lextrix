import type Attributor from './attributor/attributor.js';
import type { Blot, BlotConstructor, Root } from './blot/abstract/blot.js';
import Scope from './scope.js';

export type RegistryDefinition = Attributor | BlotConstructor;

export interface RegistryInterface {
  create(scroll: Root, input: Node | string | Scope, value?: unknown): Blot;
  query(query: string | Node | Scope, scope: Scope): RegistryDefinition | null;
  register(...definitions: RegistryDefinition[]): RegistryDefinition[];
}
