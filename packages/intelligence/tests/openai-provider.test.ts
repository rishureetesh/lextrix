/**
 * Phase 6F–6G — OpenAI provider with mocked fetch (no network / no API key).
 */
import { describe, expect, it, vi } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  DocumentHandle,
  ProposalError,
} from 'lextrix-change/experimental';
import {
  createIntelligenceRequest,
  parseStructuredEdit,
  assertStructuredEditInRequestRange,
  extractJsonObject,
  IntelligenceProviderError,
  IntelligenceParseError,
} from '../src/index.js';
import { OpenAiDocumentIntelligenceProvider } from '../src/openai/index.js';

function textOf(cs: ChangeSet): string {
  let t = '';
  for (const op of cs.ops) {
    if (typeof op.insert === 'string') t += op.insert;
  }
  return t;
}

function mockOpenAiResponse(content: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content:
              typeof content === 'string' ? content : JSON.stringify(content),
          },
        },
      ],
    }),
  } as Response;
}

describe('OpenAI structured output parsing', () => {
  it('accepts operation:replace JSON', () => {
    const edit = parseStructuredEdit(
      { operation: 'replace', text: 'hi', start: 0, end: 2 },
      { allowOps: false },
    );
    expect(edit).toEqual({ kind: 'replace-range', text: 'hi' });
  });

  it('rejects ops from LLM path', () => {
    expect(() =>
      parseStructuredEdit(
        { kind: 'ops', ops: [{ insert: 'x' }] },
        { allowOps: false },
      ),
    ).toThrow(IntelligenceParseError);
  });

  it('rejects bare prose without allowBareString', () => {
    expect(() =>
      parseStructuredEdit('Here is the revised paragraph...', {
        allowBareString: false,
      }),
    ).toThrow(IntelligenceParseError);
  });

  it('extractJsonObject strips markdown fences', () => {
    const v = extractJsonObject('```json\n{"operation":"replace","text":"Z"}\n```');
    expect(v).toEqual({ operation: 'replace', text: 'Z' });
  });

  it('rejects start/end outside request range', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdef\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'rewrite',
      range: { start: 2, end: 5 },
    });
    expect(() =>
      assertStructuredEditInRequestRange(request, {
        operation: 'replace',
        text: 'XXX',
        start: 0,
        end: 6,
      }),
    ).toThrow(IntelligenceProviderError);
  });
});

describe('OpenAiDocumentIntelligenceProvider (mocked fetch)', () => {
  it('generate → inspect → accept full flow', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('The quick brown fox.\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'Make the selected word more vivid',
      operation: 'replace',
      range: { start: 4, end: 9 },
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        messages?: { content: string }[];
      };
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization ?? headers.Authorization).toMatch(/^Bearer /);
      expect(body.messages?.[1]?.content).toContain(request.baseVersionId);
      return mockOpenAiResponse({
        operation: 'replace',
        text: 'swift',
        start: 4,
        end: 9,
      });
    });

    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: 'test-key-not-real',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const proposal = await provider.generate(request);
    expect(proposal.baseVersionId).toBe(request.baseVersionId);
    expect(proposal.meta.provider).toBe('openai');
    expect(proposal.meta.model).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const inspected = handle.inspectProposal(proposal);
    expect(inspected.ok).toBe(true);
    handle.acceptProposal(proposal);
    expect(textOf(handle.getContents())).toBe('The swift brown fox.\n');
  });

  it('stale proposal remains stale after HEAD advances during "in flight"', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'uppercase',
      range: { start: 0, end: 5 },
    });
    const base = request.baseVersionId;

    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: 'test-key-not-real',
      fetch: (async () =>
        mockOpenAiResponse({
          operation: 'replace',
          text: 'HELLO',
          start: 0,
          end: 5,
        })) as unknown as typeof fetch,
    });

    const proposal = await provider.generate(request);
    handle.apply(new ChangeSet().retain(0).insert('!'));
    expect(proposal.baseVersionId).toBe(base);
    expect(() => handle.acceptProposal(proposal)).toThrow(ProposalError);
    handle.acceptProposal(handle.rebaseProposal(proposal));
    expect(textOf(handle.getContents())).toContain('HELLO');
  });

  it('malformed model JSON fails safely', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('ab\n'),
    });
    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: 'test-key-not-real',
      fetch: (async () =>
        mockOpenAiResponse('not json at all')) as unknown as typeof fetch,
    });
    await expect(
      provider.generate(
        createIntelligenceRequest(handle, {
          instruction: 'x',
          range: { start: 0, end: 2 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'provider_malformed' });
  });

  it('out-of-range model positions rejected', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdef\n'),
    });
    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: 'test-key-not-real',
      fetch: (async () =>
        mockOpenAiResponse({
          operation: 'replace',
          text: 'ZZ',
          start: 0,
          end: 6,
        })) as unknown as typeof fetch,
    });
    await expect(
      provider.generate(
        createIntelligenceRequest(handle, {
          instruction: 'x',
          range: { start: 2, end: 4 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'out_of_range' });
  });

  it('HTTP 429 maps to provider_rate_limited', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('x\n'),
    });
    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: 'test-key-not-real',
      fetch: (async () =>
        ({
          ok: false,
          status: 429,
          json: async () => ({}),
        }) as Response) as unknown as typeof fetch,
    });
    await expect(
      provider.generate(
        createIntelligenceRequest(handle, { instruction: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'provider_rate_limited' });
  });

  it('missing API key → provider_unavailable', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('x\n'),
    });
    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: '',
      fetch: (async () => mockOpenAiResponse({})) as unknown as typeof fetch,
    });
    await expect(
      provider.generate(
        createIntelligenceRequest(handle, { instruction: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'provider_unavailable' });
  });

  it('rejects embed-bearing ranges', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet()
        .insert('a')
        .insert({ image: 'x.png' })
        .insert('b\n'),
    });
    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: 'test-key-not-real',
      fetch: (async () => mockOpenAiResponse({})) as unknown as typeof fetch,
    });
    await expect(
      provider.generate(
        createIntelligenceRequest(handle, {
          instruction: 'rewrite',
          range: { start: 0, end: 3 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'unsupported_content' });
  });

  it('provider never mutates Document during generate', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('cat\n'),
    });
    const before = handle.listVersions().length;
    const provider = new OpenAiDocumentIntelligenceProvider({
      apiKey: 'test-key-not-real',
      fetch: (async () =>
        mockOpenAiResponse({
          operation: 'replace',
          text: 'dog',
          start: 0,
          end: 3,
        })) as unknown as typeof fetch,
    });
    await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace',
        range: { start: 0, end: 3 },
      }),
    );
    expect(handle.listVersions()).toHaveLength(before);
    expect(textOf(handle.getContents())).toBe('cat\n');
  });
});
