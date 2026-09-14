import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const packageRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: packageRoot,
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'lextrix-change/experimental': resolve(
        packageRoot,
        '../change/src/experimental/index.ts',
      ),
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
      'lextrix-serialize$': resolve(packageRoot, '../serialize/src/index.ts'),
      'lextrix-serialize': resolve(packageRoot, '../serialize/src'),
      'lextrix-intelligence': resolve(
        packageRoot,
        '../intelligence/src/index.ts',
      ),
    },
  },
  test: {
    include: ['test/unit/**/*.spec.ts'],
    typecheck: {
      enabled: true,
      include: ['test/types/**/*.test-d.ts'],
      // Editor/theme modules and unit specs that probe private module state still
      // carry TypeScript debt; fail only on dedicated .test-d.ts type tests.
      ignoreSourceErrors: true,
    },
    setupFiles: [
      resolve(__dirname, '__helpers__/expect.ts'),
      resolve(__dirname, '__helpers__/cleanup.ts'),
    ],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
