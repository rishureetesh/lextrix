import type { BlotConstructor } from 'lextrix-dom';

const MAX_ITERATIONS = 100;

/** Resolves requiredContainer chains when registering format blots. */
export function collectContainerChain(
  format: BlotConstructor | null | undefined,
): BlotConstructor[] {
  const chain: BlotConstructor[] = [];
  let current = format;
  let iterations = 0;

  while (current) {
    chain.push(current);
    current = current.requiredContainer ?? null;
    iterations += 1;
    if (iterations > MAX_ITERATIONS) {
      throw new Error('Cycle detected in format requiredContainer chain');
    }
  }

  return chain;
}

export function registerFormatWithContainers(
  registry: { register(def: BlotConstructor): unknown },
  format: BlotConstructor,
): void {
  for (const def of collectContainerChain(format)) {
    registry.register(def);
  }
}
