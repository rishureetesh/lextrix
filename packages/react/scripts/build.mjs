import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageRoot, '../..');
const distDir = join(packageRoot, 'dist');

rmSync(distDir, { recursive: true, force: true });

const tsc = spawnSync('npx', ['tsc', '-p', 'tsconfig.json'], {
  cwd: packageRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

const sourcePkg = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
);

const publishPkg = {
  name: sourcePkg.name,
  version: sourcePkg.version,
  description: sourcePkg.description,
  author: sourcePkg.author,
  homepage: sourcePkg.homepage,
  license: sourcePkg.license,
  repository: sourcePkg.repository,
  bugs: sourcePkg.bugs,
  type: 'module',
  main: './index.js',
  types: './index.d.ts',
  exports: {
    '.': {
      types: './index.d.ts',
      import: './index.js',
      default: './index.js',
    },
  },
  sideEffects: false,
  peerDependencies: sourcePkg.peerDependencies,
  peerDependenciesMeta: sourcePkg.peerDependenciesMeta,
  keywords: sourcePkg.keywords,
  engines: sourcePkg.engines,
};

writeFileSync(
  join(distDir, 'package.json'),
  `${JSON.stringify(publishPkg, null, 2)}\n`,
  'utf8',
);

cpSync(join(packageRoot, 'README.md'), join(distDir, 'README.md'));
cpSync(join(repoRoot, 'LICENSE'), join(distDir, 'LICENSE'));

console.log('built @lextrix/react → dist/');
