/** Lextrix core — document editor shell. */
export const lxrPath = {
  blot: (name: string) => `lxr/blots/${name}`,
  format: (name: string) => `lxr/formats/${name}`,
  module: (name: string) => `lxr/modules/${name}`,
  attributor: (scope: string, name: string) =>
    `lxr/attributors/${scope}/${name}`,
  theme: (name: string) => `lxr/themes/${name}`,
  ui: (name: string) => `lxr/ui/${name}`,
  core: {
    module: 'lxr/core/module',
    theme: 'lxr/core/theme',
  },
} as const;

export function isBlotOrFormatPath(path: string): boolean {
  return path.startsWith('lxr/blots/') || path.startsWith('lxr/formats/');
}

const BARE_PATH_PREFIXES: ReadonlyArray<{
  prefix: string;
  map: (name: string) => string;
}> = [
  { prefix: 'themes/', map: (n) => lxrPath.theme(n) },
  { prefix: 'modules/', map: (n) => lxrPath.module(n) },
  { prefix: 'formats/', map: (n) => lxrPath.format(n) },
  { prefix: 'blots/', map: (n) => lxrPath.blot(n) },
  { prefix: 'ui/', map: (n) => lxrPath.ui(n) },
];

/** Normalize a registry/import path to canonical `lxr/*` form. */
export function resolveImportKey(name: string): string {
  if (name === 'change' || name === 'dom' || name.startsWith('lxr/')) {
    return name;
  }
  if (name === 'core/module') {
    return lxrPath.core.module;
  }
  if (name === 'core/theme') {
    return lxrPath.core.theme;
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
