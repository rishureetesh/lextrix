/* eslint-env node */
module.exports = {
  root: true,
  ignorePatterns: ['dist/**', 'node_modules/**', 'storybook-static/**', '**/*.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: ['../../tsconfig.json', 'tsconfig.json'],
      },
    },
  },
  rules: {
    'prettier/prettier': ['warn', { endOfLine: 'auto' }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'import/no-unresolved': 'off',
  },
  overrides: [
    {
      files: ['test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
    {
      files: ['scripts/**/*.mjs'],
      env: { node: true },
    },
  ],
};
