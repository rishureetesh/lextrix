const pkg = require('./package.json');

module.exports = {
  presets: [
    ['@babel/preset-env', { modules: false }],
    '@babel/preset-typescript',
  ],
  plugins: [
    ['transform-define', { LEXTRIX_VERSION: pkg.version }],
    './scripts/babel-svg-inline-import.cjs',
  ],
};
