import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'lextrix-change': resolve(__dirname, 'src/index.ts'),
    },
    extensions: ['.ts', '.js'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
