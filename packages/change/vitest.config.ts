import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'lextron-change': resolve(__dirname, 'src/index.ts'),
    },
    extensions: ['.ts', '.js'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
