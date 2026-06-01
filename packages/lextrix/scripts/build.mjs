import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const repoRoot = join(packageRoot, '../..');
const distDir = join(packageRoot, 'dist', 'dist');
const mode = process.argv[2] || 'production';

const require = createRequire(join(packageRoot, 'package.json'));
const webpackCli = require.resolve('webpack-cli/bin/cli.js');

const webpack = spawnSync(
  process.execPath,
  [webpackCli, '--config', 'webpack.config.cjs', '--mode', mode],
  { cwd: packageRoot, stdio: 'inherit' },
);

if (webpack.status !== 0) {
  process.exit(webpack.status ?? 1);
}

mkdirSync(join(packageRoot, 'dist'), { recursive: true });

for (const name of readdirSync(distDir)) {
  if (/\.css\.js(\..*)?$/.test(name)) {
    rmSync(join(distDir, name), { force: true });
  }
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
  main: 'lextrix.js',
  type: 'module',
  exports: {
    '.': { import: './lextrix.js', default: './lextrix.js' },
    './core': { import: './lextrix.core.js', default: './lextrix.core.js' },
    './lextrix.css': './lextrix.core.css',
    './snow.css': './lextrix.snow.css',
    './bubble.css': './lextrix.bubble.css',
    './slate.css': './lextrix.slate.css',
    './dawn.css': './lextrix.dawn.css',
  },
  files: [
    'lextrix.js',
    'lextrix.core.js',
    'lextrix.core.css',
    'lextrix.snow.css',
    'lextrix.bubble.css',
    'lextrix.slate.css',
    'lextrix.dawn.css',
    'README.md',
    'LICENSE',
    'NOTICE.md',
  ],
  keywords: sourcePkg.keywords,
  engines: sourcePkg.engines,
};

writeFileSync(
  join(distDir, 'package.json'),
  `${JSON.stringify(publishPkg, null, 2)}\n`,
  'utf8',
);

writeFileSync(
  join(distDir, '.npmignore'),
  ['*.map', '*.LICENSE.txt'].join('\n') + '\n',
  'utf8',
);

for (const file of ['README.md', 'LICENSE', 'NOTICE.md']) {
  cpSync(join(repoRoot, file), join(distDir, file));
}

console.log(`built ${mode} → dist/dist/`);
