import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'lextrix-change': resolve(root, '../change/src/index.ts'),
      'lextrix-dom': resolve(root, '../dom/src/index.ts'),
      'lextrix-core$': resolve(root, '../core/src/index.ts'),
      'lextrix-core': resolve(root, '../core/src'),
      'lextrix-formats$': resolve(root, '../formats/src/index.ts'),
      'lextrix-formats': resolve(root, '../formats/src'),
      'lextrix-modules$': resolve(root, '../modules/src/index.ts'),
      'lextrix-modules': resolve(root, '../modules/src'),
      'lextrix-ui$': resolve(root, '../ui/src/index.ts'),
      'lextrix-ui': resolve(root, '../ui/src'),
      'lextrix-themes$': resolve(root, '../themes/src/index.ts'),
      'lextrix-themes': resolve(root, '../themes/src'),
    },
  },
  test: {
    include: ['test/fuzz/**/*.spec.ts'],
    environment: 'jsdom',
    testTimeout: 40000,
    pool: 'threads',
  },
});
