import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^lextrix-core\/blots\/(.+)\.js$/,
        replacement: resolve(__dirname, '../core/src/blots/$1.ts'),
      },
      {
        find: /^lextrix-core\/(.+)$/,
        replacement: resolve(__dirname, '../core/src/$1.ts'),
      },
      {
        find: 'lextrix-core',
        replacement: resolve(__dirname, '../core/src/index.ts'),
      },
      {
        find: 'lextrix-dom',
        replacement: resolve(__dirname, '../dom/src/index.ts'),
      },
      {
        find: 'lextrix-change',
        replacement: resolve(__dirname, '../change/src/index.ts'),
      },
    ],
    extensions: ['.ts', '.js'],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
