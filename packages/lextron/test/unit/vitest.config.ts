import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const packageRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: packageRoot,
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'lextron-change': resolve(packageRoot, '../change/src/index.ts'),
      'lextron-dom': resolve(packageRoot, '../dom/src/index.ts'),
      'lextron-core$': resolve(packageRoot, '../core/src/index.ts'),
      'lextron-core': resolve(packageRoot, '../core/src'),
      'lextron-formats$': resolve(packageRoot, '../formats/src/index.ts'),
      'lextron-formats': resolve(packageRoot, '../formats/src'),
      'lextron-modules$': resolve(packageRoot, '../modules/src/index.ts'),
      'lextron-modules': resolve(packageRoot, '../modules/src'),
      'lextron-ui$': resolve(packageRoot, '../ui/src/index.ts'),
      'lextron-ui': resolve(packageRoot, '../ui/src'),
      'lextron-themes$': resolve(packageRoot, '../themes/src/index.ts'),
      'lextron-themes': resolve(packageRoot, '../themes/src'),
    },
  },
  test: {
    include: ['test/unit/**/*.spec.ts'],
    typecheck: {
      enabled: true,
      include: ['test/types/**/*.test-d.ts'],
    },
    setupFiles: [
      resolve(__dirname, '__helpers__/expect.ts'),
      resolve(__dirname, '__helpers__/cleanup.ts'),
    ],
    browser: {
      enabled: true,
      provider: 'playwright',
      name: process.env.BROWSER || 'chromium',
    },
  },
});
