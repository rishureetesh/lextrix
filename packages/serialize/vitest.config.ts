import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'lextrix-change': resolve(__dirname, '../change/src/index.ts'),
      'lextrix-serialize': resolve(__dirname, 'src/index.ts'),
      'lextrix-dom': resolve(__dirname, '../dom/src/index.ts'),
      'lextrix-core': resolve(__dirname, '../core/src'),
      'lextrix-core$': resolve(__dirname, '../core/src/index.ts'),
      'lextrix-formats': resolve(__dirname, '../formats/src'),
      'lextrix-formats$': resolve(__dirname, '../formats/src/index.ts'),
      'lextrix-modules': resolve(__dirname, '../modules/src'),
      'lextrix-modules$': resolve(__dirname, '../modules/src/index.ts'),
      'lextrix-modules/html-import': resolve(__dirname, '../modules/src/html-import/index.ts'),
    },
    extensions: ['.ts', '.js'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts'],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 75,
        statements: 85,
      },
    },
  },
});
