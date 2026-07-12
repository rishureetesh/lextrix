import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.spec.tsx'],
    setupFiles: ['./test/setup.ts'],
  },
});
