import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const packageRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: packageRoot,
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'lextrix-change': resolve(packageRoot, '../change/src/index.ts'),
      'lextrix-dom': resolve(packageRoot, '../dom/src/index.ts'),
      'lextrix-core$': resolve(packageRoot, '../core/src/index.ts'),
      'lextrix-core': resolve(packageRoot, '../core/src'),
      'lextrix-formats$': resolve(packageRoot, '../formats/src/index.ts'),
      'lextrix-formats': resolve(packageRoot, '../formats/src'),
      'lextrix-modules$': resolve(packageRoot, '../modules/src/index.ts'),
      'lextrix-modules': resolve(packageRoot, '../modules/src'),
      'lextrix-ui$': resolve(packageRoot, '../ui/src/index.ts'),
      'lextrix-ui': resolve(packageRoot, '../ui/src'),
      'lextrix-themes$': resolve(packageRoot, '../themes/src/index.ts'),
      'lextrix-themes': resolve(packageRoot, '../themes/src'),
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
