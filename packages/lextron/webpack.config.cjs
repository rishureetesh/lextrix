/*eslint-env node*/

const { BannerPlugin, DefinePlugin } = require('webpack');
const common = require('./webpack.common.cjs');
const { merge } = require('webpack-merge');
require('webpack-dev-server');
const { readFileSync } = require('fs');
const { join, resolve } = require('path');

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const bannerPack = new BannerPlugin({
  banner: [
    `Lextron Editor v${pkg.version}`,
    pkg.homepage,
    `Copyright (c) ${new Date().getFullYear()} Reetesh`,
    'See NOTICE.md for third-party attributions.',
  ].join('\n'),
  entryOnly: true,
});
const constantPack = new DefinePlugin({
  LEXTRON_VERSION: JSON.stringify(pkg.version),
});

module.exports = (env) =>
  merge(common, {
    mode: env.production ? 'production' : 'development',
    devtool: 'source-map',
    plugins: [bannerPack, constantPack],
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
