/** Lextron core — document editor shell. */
export const lxtPath = {
  blot: (name: string) => `lxt/blots/${name}`,
  format: (name: string) => `lxt/formats/${name}`,
  module: (name: string) => `lxt/modules/${name}`,
  attributor: (scope: string, name: string) =>
    `lxt/attributors/${scope}/${name}`,
  theme: (name: string) => `lxt/themes/${name}`,
  ui: (name: string) => `lxt/ui/${name}`,
  core: {
    module: 'lxt/core/module',
    theme: 'lxt/core/theme',
  },
} as const;

export function isBlotOrFormatPath(path: string): boolean {
  return path.startsWith('lxt/blots/') || path.startsWith('lxt/formats/');
}

const BARE_PATH_PREFIXES: ReadonlyArray<{
  prefix: string;
  map: (name: string) => string;
}> = [
  { prefix: 'themes/', map: (n) => lxtPath.theme(n) },
  { prefix: 'modules/', map: (n) => lxtPath.module(n) },
  { prefix: 'formats/', map: (n) => lxtPath.format(n) },
  { prefix: 'blots/', map: (n) => lxtPath.blot(n) },
  { prefix: 'ui/', map: (n) => lxtPath.ui(n) },
];

/** Normalize a registry/import path to canonical `lxt/*` form. */
export function resolveImportKey(name: string): string {
  if (name === 'change' || name === 'dom' || name.startsWith('lxt/')) {
    return name;
  }
  if (name === 'core/module') {
    return lxtPath.core.module;
  }
  if (name === 'core/theme') {
    return lxtPath.core.theme;
  }
  for (const { prefix, map } of BARE_PATH_PREFIXES) {
    if (name.startsWith(prefix)) {
      throw new Error(
        `Legacy import path "${name}" is not supported. Use "${map(name.slice(prefix.length))}" instead.`,
      );
    }
  }
  if (name === 'delta' || name === 'parchment') {
    throw new Error(
      `Legacy import key "${name}" is not supported. Use "${name === 'delta' ? 'change' : 'dom'}" instead.`,
    );
  }
  return name;
}
