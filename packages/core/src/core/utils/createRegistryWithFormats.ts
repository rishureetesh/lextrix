/** Lextrix core — document editor shell. */
import { Registry } from 'lextrix-dom';
import { registerFormatWithContainers } from '../registry/format-dependency-graph.js';

const CORE_FORMATS = ['block', 'break', 'cursor', 'inline', 'scroll', 'text'];

const createRegistryWithFormats = (
  formats: string[],
  sourceRegistry: Registry,
  debug: { error: (errorMessage: string) => void },
) => {
  const registry = new Registry();
  CORE_FORMATS.forEach((name) => {
    const coreBlot = sourceRegistry.query(name);
    if (coreBlot) registry.register(coreBlot);
  });

  formats.forEach((name) => {
    const format = sourceRegistry.query(name);
    if (!format) {
      debug.error(
        `Cannot register "${name}" specified in "formats" config. Are you sure it was registered?`,
      );
      return;
    }
    if ('blotName' in format) {
      try {
        registerFormatWithContainers(registry, format);
      } catch {
        debug.error(
          `Cycle detected in registering blot requiredContainer: "${name}"`,
        );
      }
    } else {
      registry.register(format);
    }
  });

  return registry;
};

export default createRegistryWithFormats;
