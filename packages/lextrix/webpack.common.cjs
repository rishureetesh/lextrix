/*eslint-env node*/
/** @deprecated Use webpack.shared.cjs — kept for tooling that still requires this path. */

const { shared, umdEntries, distPath } = require('./webpack.shared.cjs');

module.exports = {
  ...shared,
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
};
