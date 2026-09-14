import { defineConfig } from 'vitest/config';

/** Live network tests only — requires OPENAI_API_KEY + LEXTRIX_INTELLIGENCE_LIVE=1 */
export default defineConfig({
  test: {
    include: ['tests/openai-live.test.ts'],
  },
});
