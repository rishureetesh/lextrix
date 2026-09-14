/**
 * Opt-in live OpenAI integration test.
 * NEVER run in default `npm test` / CI.
 *
 * Requires:
 *   OPENAI_API_KEY=...
 *   LEXTRIX_INTELLIGENCE_LIVE=1
 *
 * Run:
 *   npm run test:intelligence:live -w lextrix-intelligence
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/experimental';
import { createIntelligenceRequest } from '../src/index.js';
import { OpenAiDocumentIntelligenceProvider } from '../src/openai/index.js';

const live =
  process.env.LEXTRIX_INTELLIGENCE_LIVE === '1' &&
  Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!live)('OpenAI live (opt-in)', () => {
  it('returns a version-bound ChangeProposal for a tiny fixture', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('The quick fox.\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'Replace the word quick with fast',
      range: { start: 4, end: 9 },
    });
    const provider = new OpenAiDocumentIntelligenceProvider({
      timeoutMs: 45_000,
    });
    const proposal = await provider.generate(request);
    expect(proposal.baseVersionId).toBe(request.baseVersionId);
    expect(proposal.meta.provider).toBe('openai');
    const inspected = handle.inspectProposal(proposal);
    expect(inspected.ok).toBe(true);
    // Do not auto-accept in live smoke — validation is enough.
  }, 60_000);
});
