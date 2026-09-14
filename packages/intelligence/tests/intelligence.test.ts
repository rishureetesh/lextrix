/**
 * Phase 6B — Document Intelligence Platform tests.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  DocumentHandle,
  parseChangeProposal,
  ProposalError,
  createInMemoryCollabPair,
} from 'lextrix-change/experimental';
import {
  createIntelligenceRequest,
  DeterministicDocumentIntelligenceProvider,
  StructuredCompletionProvider,
  extractRequestContext,
  IntelligenceRequestError,
} from '../src/index.js';

function documentsEqual(a: ChangeSet, b: ChangeSet): boolean {
  return JSON.stringify(a.ops) === JSON.stringify(b.ops);
}

describe('Document Intelligence (Phase 6B)', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  it('request carries version-bound contents and range; provider does not mutate Document', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('The quick brown fox.\n'),
    });
    const before = handle.currentVersion().id;
    const count = handle.listVersions().length;
    const range = handle.createRange(4, 9); // "quick"
    const request = createIntelligenceRequest(handle, {
      instruction: 'uppercase selection',
      operation: 'transform',
      range,
    });
    expect(request.baseVersionId).toBe(before);
    expect(request.range).toEqual({ start: 4, end: 9 });
    const ctx = extractRequestContext(request);
    expect(ctx.selectedText).toBe('quick');

    const proposal = await provider.generate(request);
    expect(handle.currentVersion().id).toBe(before);
    expect(handle.listVersions()).toHaveLength(count);
    expect(proposal.baseVersionId).toBe(before);
    expect(proposal.meta.source).toBe('ai');
    expect(proposal.meta.provider).toBe('deterministic');
  });

  it('generate → inspect → accept lifecycle', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'rewrite',
      operation: 'rewrite',
      range: handle.createRange(0, 11),
    });
    const proposal = await provider.generate(request);
    const inspected = handle.inspectProposal(proposal);
    expect(inspected.ok).toBe(true);
    if (inspected.ok) expect(inspected.stale).toBe(false);
    handle.acceptProposal(proposal);
    expect(handle.getContents().ops[0]?.insert).toBe('hello world\n');
  });

  it('stale AI proposal remains stale; explicit rebase then accept', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdefghijklmnopqrstuvwxyz\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'shorten',
      operation: 'shorten',
      range: handle.createRange(0, 26),
      context: { maxLength: 8 },
    });
    const proposal = await provider.generate(request);
    handle.apply(new ChangeSet().retain(0).insert('>'));
    expect(() => handle.acceptProposal(proposal)).toThrow(ProposalError);
    const inspected = handle.inspectProposal(proposal);
    expect(inspected.ok).toBe(true);
    if (inspected.ok) expect(inspected.stale).toBe(true);

    const originalBase = proposal.baseVersionId;
    const rebased = handle.rebaseProposal(proposal);
    expect(proposal.baseVersionId).toBe(originalBase);
    expect(rebased).not.toBe(proposal);
    expect(rebased.meta.source).toBe('ai');
    handle.acceptProposal(rebased);
    expect(handle.listVersions().length).toBeGreaterThan(2);
  });

  it('replace operation uses context.replacement', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('The quick brown fox.\n'),
    });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace selection',
        operation: 'replace',
        range: handle.createRange(4, 9),
        context: { replacement: 'fast' },
      }),
    );
    handle.acceptProposal(proposal);
    expect(extractText(handle.getContents())).toContain('fast');
    expect(extractText(handle.getContents())).not.toContain('quick');
  });

  it('serialization round-trip preserves intelligence metadata', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello there friend\n'),
    });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'shorten',
        operation: 'shorten',
        range: { start: 0, end: 17 },
        context: { maxLength: 10 },
      }),
    );
    const again = parseChangeProposal(JSON.stringify(proposal.toJSON()));
    expect(again.meta.provider).toBe('deterministic');
    expect(again.change.ops).toEqual(proposal.change.ops);
  });

  it('range version mismatch is rejected at request construction', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcd\n'),
    });
    const range = handle.createRange(0, 2);
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    expect(() =>
      createIntelligenceRequest(handle, {
        instruction: 'x',
        range,
      }),
    ).toThrow(IntelligenceRequestError);
  });

  it('concurrent human + intelligence proposals converge via rebase', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v0 = handle.currentVersion();
    const aiReq = createIntelligenceRequest(handle, {
      instruction: 'replace:HELLO',
      operation: 'replace',
      range: handle.createRange(0, 5),
      context: { replacement: 'HELLO' },
    });
    const ai = await provider.generate(aiReq);
    const human = handle.createProposal(new ChangeSet().retain(5).insert('!'), {
      meta: { source: 'user' },
      baseVersionId: v0.id,
    });
    handle.acceptProposal(human);
    const ai2 = handle.rebaseProposal(ai);
    handle.acceptProposal(ai2);

    const A = new ChangeSet().retain(5).insert('!');
    const B = new ChangeSet().retain(0).delete(5).insert('HELLO').retain(1);
    const left = new ChangeSet()
      .insert('hello\n')
      .compose(A)
      .compose(A.transform(B, true));
    expect(documentsEqual(handle.getContents(), left)).toBe(true);
  });

  it('two AI proposals concurrent converge', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcd\n'),
    });
    const a = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace:XX',
        operation: 'replace',
        range: { start: 0, end: 2 },
        context: { replacement: 'XX' },
      }),
    );
    const b = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace:YY',
        operation: 'replace',
        range: { start: 2, end: 4 },
        context: { replacement: 'YY' },
      }),
    );
    handle.acceptProposal(a);
    const b2 = handle.rebaseProposal(b);
    handle.acceptProposal(b2);
    expect(extractText(handle.getContents())).toBe('XXYY\n');
  });

  it('structured completion provider injects completion without SDK', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('cat\n'),
    });
    const structured = new StructuredCompletionProvider({
      id: 'fake-llm',
      model: 'test-model',
      complete: async (_req, extracted) => ({
        kind: 'replace-range',
        text: `${extracted.selectedText.toUpperCase()}!`,
      }),
    });
    const proposal = await structured.generate(
      createIntelligenceRequest(handle, {
        instruction: 'shout',
        range: { start: 0, end: 3 },
      }),
    );
    expect(proposal.meta.provider).toBe('fake-llm');
    handle.acceptProposal(proposal);
    expect(extractText(handle.getContents())).toBe('CAT!\n');
  });

  it('collab adapter treats intelligence ChangeSets as ordinary remotes', async () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('go\n'));
    coordinator.setAutoDeliver(false);
    const proposal = await provider.generate(
      createIntelligenceRequest(handleA, {
        instruction: 'replace:OK',
        operation: 'replace',
        range: { start: 0, end: 2 },
        context: { replacement: 'OK' },
      }),
    );
    const baseA = handleA.currentVersion().id;
    const baseB = handleB.currentVersion().id;
    handleA.acceptProposal(proposal);
    clientA.submitLocal(proposal.change, {
      baseVersionId: baseA,
      meta: { source: 'ai', provider: 'deterministic' },
    });
    const human = new ChangeSet().retain(2).insert('!');
    handleB.apply(human);
    clientB.submitLocal(human, { baseVersionId: baseB });
    coordinator.flush();
    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      true,
    );
    clientA.destroy();
    clientB.destroy();
  });
});

function extractText(cs: ChangeSet): string {
  let t = '';
  for (const op of cs.ops) {
    if (typeof op.insert === 'string') t += op.insert;
  }
  return t;
}
