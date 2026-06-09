/*eslint-env node*/

const { BannerPlugin, DefinePlugin } = require('webpack');
const { merge } = require('webpack-merge');
const { readFileSync } = require('fs');
const { join, resolve } = require('path');
const { shared, umdEntries, esmEntries, distPath } = require('./webpack.shared.cjs');
require('webpack-dev-server');

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const bannerPack = new BannerPlugin({
  banner: [
    `Lextrix Editor v${pkg.version}`,
    pkg.homepage,
    `Copyright (c) ${new Date().getFullYear()} Reetesh`,
    'See NOTICE.md for third-party attributions.',
  ].join('\n'),
  entryOnly: true,
});
const constantPack = new DefinePlugin({
  LEXTRIX_VERSION: JSON.stringify(pkg.version),
});

const buildPlugins = [bannerPack, constantPack];

module.exports = (env = {}, argv = {}) => {
  const mode =
    argv.mode || (env.production || env?.WEBPACK_BUILD === 'production'
      ? 'production'
      : 'development');

  const umdConfig = merge(shared, {
    mode,
    devtool: 'source-map',
    entry: umdEntries,
    output: {
      filename: '[name].js',
      library: {
        name: 'Lextrix',
        type: 'umd',
        export: 'default',
      },
      path: distPath,
      clean: true,
    },
    plugins: buildPlugins,
    devServer: {
      static: {
        directory: resolve(__dirname, '../demo'),
      },
      open: ['/index.html'],
      hot: false,
      allowedHosts: 'all',
      devMiddleware: {
        stats: 'minimal',
      },
    },
    stats: 'minimal',
  });

  const esmConfig = merge(shared, {
    mode,
    devtool: 'source-map',
    experiments: {
      outputModule: true,
    },
    entry: esmEntries,
    output: {
      filename: '[name].js',
      path: distPath,
      module: true,
      library: {
        type: 'module',
      },
      environment: {
        module: true,
      },
      clean: false,
    },
    plugins: buildPlugins,
    stats: 'minimal',
  });

  return [umdConfig, esmConfig];
};
