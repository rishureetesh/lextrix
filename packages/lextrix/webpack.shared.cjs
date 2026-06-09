/*eslint-env node*/

const { resolve } = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const packageRoots = [
  resolve(__dirname, 'src'),
  resolve(__dirname, '../core/src'),
  resolve(__dirname, '../formats/src'),
  resolve(__dirname, '../modules/src'),
  resolve(__dirname, '../ui/src'),
  resolve(__dirname, '../themes/src'),
  resolve(__dirname, '../change/src'),
  resolve(__dirname, '../dom/src'),
  resolve(__dirname, '../serialize/src'),
];

const tsRules = {
  test: /\.ts$/,
  include: packageRoots,
  use: ['babel-loader'],
};

const sourceMapRules = {
  test: /\.js$/,
  enforce: 'pre',
  use: ['source-map-loader'],
};

const svgRules = {
  test: /\.svg$/,
  include: [resolve(__dirname, '../ui/src/assets/icons')],
  use: [
    {
      loader: 'html-loader',
      options: {
        minimize: true,
      },
    },
  ],
};

const stylRules = {
  test: /\.styl$/,
  include: [resolve(__dirname, '../themes/src/assets')],
  use: [MiniCssExtractPlugin.loader, 'css-loader', 'stylus-loader'],
};

const shared = {
  resolve: {
    extensions: ['.js', '.styl', '.ts'],
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
    alias: {
      'lextrix-change': resolve(__dirname, '../change/src/index.ts'),
      'lextrix-dom': resolve(__dirname, '../dom/src/index.ts'),
      'lextrix-core$': resolve(__dirname, '../core/src/index.ts'),
      'lextrix-core': resolve(__dirname, '../core/src'),
      'lextrix-formats$': resolve(__dirname, '../formats/src/index.ts'),
      'lextrix-formats': resolve(__dirname, '../formats/src'),
      'lextrix-modules$': resolve(__dirname, '../modules/src/index.ts'),
      'lextrix-modules': resolve(__dirname, '../modules/src'),
      'lextrix-ui$': resolve(__dirname, '../ui/src/index.ts'),
      'lextrix-ui': resolve(__dirname, '../ui/src'),
      'lextrix-themes$': resolve(__dirname, '../themes/src/index.ts'),
      'lextrix-themes': resolve(__dirname, '../themes/src'),
      'lextrix-serialize$': resolve(__dirname, '../serialize/src/index.ts'),
      'lextrix-serialize': resolve(__dirname, '../serialize/src'),
    },
  },
  module: {
    rules: [tsRules, stylRules, svgRules, sourceMapRules],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name]',
    }),
  ],
};

const umdEntries = {
  lextrix: './src/lextrix.ts',
  'lextrix.core': './src/core.ts',
  'lextrix.core.css': '../themes/src/assets/core.styl',
  'lextrix.bubble.css': '../themes/src/assets/bubble.styl',
  'lextrix.dawn.css': '../themes/src/assets/dawn.styl',
  'lextrix.slate.css': '../themes/src/assets/slate.styl',
  'lextrix.snow.css': '../themes/src/assets/snow.styl',
};

const esmEntries = {
  'lextrix.esm': './src/lextrix.ts',
  'lextrix.core.esm': './src/core.ts',
};

const distPath = resolve(__dirname, 'dist/dist');

module.exports = { shared, umdEntries, esmEntries, distPath };
