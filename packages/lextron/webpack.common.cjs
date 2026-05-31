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

module.exports = {
  entry: {
    lextron: './src/lextron.ts',
    'lextron.core': './src/core.ts',
    'lextron.core.css': '../themes/src/assets/core.styl',
    'lextron.bubble.css': '../themes/src/assets/bubble.styl',
    'lextron.dawn.css': '../themes/src/assets/dawn.styl',
    'lextron.slate.css': '../themes/src/assets/slate.styl',
    'lextron.snow.css': '../themes/src/assets/snow.styl',
  },
  output: {
    filename: '[name].js',
    library: {
      name: 'Lextron',
      type: 'umd',
      export: 'default',
    },
    path: resolve(__dirname, 'dist/dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.styl', '.ts'],
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
    alias: {
      'lextron-change': resolve(__dirname, '../change/src/index.ts'),
      'lextron-dom': resolve(__dirname, '../dom/src/index.ts'),
      'lextron-core$': resolve(__dirname, '../core/src/index.ts'),
      'lextron-core': resolve(__dirname, '../core/src'),
      'lextron-formats$': resolve(__dirname, '../formats/src/index.ts'),
      'lextron-formats': resolve(__dirname, '../formats/src'),
      'lextron-modules$': resolve(__dirname, '../modules/src/index.ts'),
      'lextron-modules': resolve(__dirname, '../modules/src'),
      'lextron-ui$': resolve(__dirname, '../ui/src/index.ts'),
      'lextron-ui': resolve(__dirname, '../ui/src'),
      'lextron-themes$': resolve(__dirname, '../themes/src/index.ts'),
      'lextron-themes': resolve(__dirname, '../themes/src'),
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
