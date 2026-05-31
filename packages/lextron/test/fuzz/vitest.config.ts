import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'lextron-change': resolve(root, '../change/src/index.ts'),
      'lextron-dom': resolve(root, '../dom/src/index.ts'),
      'lextron-core$': resolve(root, '../core/src/index.ts'),
      'lextron-core': resolve(root, '../core/src'),
      'lextron-formats$': resolve(root, '../formats/src/index.ts'),
      'lextron-formats': resolve(root, '../formats/src'),
      'lextron-modules$': resolve(root, '../modules/src/index.ts'),
      'lextron-modules': resolve(root, '../modules/src'),
      'lextron-ui$': resolve(root, '../ui/src/index.ts'),
      'lextron-ui': resolve(root, '../ui/src'),
      'lextron-themes$': resolve(root, '../themes/src/index.ts'),
      'lextron-themes': resolve(root, '../themes/src'),
    },
  },
  test: {
    include: ['test/fuzz/**/*.spec.ts'],
    environment: 'jsdom',
    testTimeout: 40000,
    pool: 'threads',
  },
});
