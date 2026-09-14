import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Opt-in live network tests — run via `npm run test:intelligence:live`
      '**/openai-live.test.ts',
    ],
  },
});
