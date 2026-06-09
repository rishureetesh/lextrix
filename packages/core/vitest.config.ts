import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'lextrix-core': resolve(__dirname, 'src/index.ts'),
      'lextrix-change': resolve(__dirname, '../change/src/index.ts'),
      'lextrix-serialize': resolve(__dirname, '../serialize/src/index.ts'),
    },
    extensions: ['.ts', '.js'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
