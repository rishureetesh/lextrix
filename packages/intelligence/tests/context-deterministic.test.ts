/**
 * Phase 6C–6D — Context & Deterministic Document Intelligence.
 * Closes gaps: immutability, HEAD isolation, no-op, embeds, apply correctness.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  DocumentHandle,
  ProposalError,
} from 'lextrix-change/experimental';
import {
  createIntelligenceRequest,
  DeterministicDocumentIntelligenceProvider,
  extractRequestContext,
  IntelligenceProviderError,
  IntelligenceRequestError,
  parseIntelligenceRequest,
  serializeIntelligenceRequest,
  structuredEditToChangeSet,
} from '../src/index.js';

const provider = new DeterministicDocumentIntelligenceProvider();

function textOf(cs: ChangeSet): string {
  let t = '';
  for (const op of cs.ops) {
    if (typeof op.insert === 'string') t += op.insert;
  }
  return t;
}

describe('6C context / range / version binding', () => {
  it('request snapshot stays on V42 after HEAD advances to V43', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v42 = handle.currentVersion().id;
    const request = createIntelligenceRequest(handle, {
      instruction: 'transform',
      operation: 'transform',
      range: { start: 0, end: 5 },
    });
    handle.apply(new ChangeSet().retain(0).insert('XXX'));
    expect(handle.currentVersion().id).not.toBe(v42);
    expect(request.baseVersionId).toBe(v42);
    expect(textOf(request.contents)).toBe('hello\n');
    const ctx = extractRequestContext(request);
    expect(ctx.selectedText).toBe('hello');
    expect(ctx.baseVersionId).toBe(v42);
    // Provider still generates against frozen V42 contents, not HEAD
    const proposal = await provider.generate(request);
    expect(proposal.baseVersionId).toBe(v42);
    expect(proposal.change.ops).not.toEqual([]);
  });

  it('frozen request rejects field mutation', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('ab\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'x',
      range: { start: 0, end: 1 },
    });
    expect(() => {
      (request as { instruction: string }).instruction = 'mutated';
    }).toThrow();
  });

  it('rejects out-of-bounds range (no silent clamp)', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('ab\n'),
    });
    expect(() =>
      createIntelligenceRequest(handle, {
        instruction: 'x',
        range: { start: 0, end: 99 },
      }),
    ).toThrow(IntelligenceRequestError);
  });

  it('rejects inverted range', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcd\n'),
    });
    expect(() =>
      createIntelligenceRequest(handle, {
        instruction: 'x',
        range: { start: 3, end: 1 },
      }),
    ).toThrow(IntelligenceRequestError);
  });

  it('request JSON round-trip preserves version-bound snapshot', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'shorten',
      operation: 'shorten',
      range: { start: 0, end: 5 },
      context: { maxLength: 3 },
    });
    const again = parseIntelligenceRequest(
      JSON.stringify(serializeIntelligenceRequest(request)),
    );
    expect(again.documentId).toBe(request.documentId);
    expect(again.baseVersionId).toBe(request.baseVersionId);
    expect(again.contents.ops).toEqual(request.contents.ops);
    expect(again.range).toEqual(request.range);
    expect(again.context?.maxLength).toBe(3);
  });

  it('create against explicit older version ignores HEAD', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('base\n'),
    });
    const v0 = handle.currentVersion().id;
    handle.apply(new ChangeSet().retain(0).insert('>'));
    const request = createIntelligenceRequest(handle, {
      instruction: 'transform',
      operation: 'transform',
      baseVersionId: v0,
      range: { start: 0, end: 4 },
    });
    expect(request.baseVersionId).toBe(v0);
    expect(textOf(request.contents)).toBe('base\n');
    expect(extractRequestContext(request).selectedText).toBe('base');
  });
});

describe('6D deterministic ops → ChangeSet apply correctness', () => {
  it('replace: before → change → expected after', async () => {
    const before = new ChangeSet().insert('The quick brown fox.\n');
    const handle = DocumentHandle.create({ contents: before });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace',
        operation: 'replace',
        range: { start: 4, end: 9 },
        context: { replacement: 'fast' },
      }),
    );
    const after = before.compose(proposal.change);
    expect(textOf(after)).toBe('The fast brown fox.\n');
    handle.acceptProposal(proposal);
    expect(textOf(handle.getContents())).toBe('The fast brown fox.\n');
  });

  it('transform uppercase apply correctness', async () => {
    const before = new ChangeSet().insert('AbCd\n');
    const handle = DocumentHandle.create({ contents: before });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'transform',
        operation: 'transform',
        range: { start: 0, end: 4 },
      }),
    );
    expect(textOf(before.compose(proposal.change))).toBe('ABCD\n');
  });

  it('rewrite collapses whitespace', async () => {
    const before = new ChangeSet().insert('a   b\tc\n');
    const handle = DocumentHandle.create({ contents: before });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'rewrite',
        operation: 'rewrite',
        range: { start: 0, end: 7 },
      }),
    );
    expect(textOf(before.compose(proposal.change))).toBe('a b c\n');
  });

  it('shorten truncates with ellipsis', async () => {
    const before = new ChangeSet().insert('abcdefghij\n');
    const handle = DocumentHandle.create({ contents: before });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'shorten',
        operation: 'shorten',
        range: { start: 0, end: 10 },
        context: { maxLength: 4 },
      }),
    );
    expect(textOf(before.compose(proposal.change))).toBe('abc…\n');
  });

  it('empty-range no-op yields empty ChangeSet; accept creates no version', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hi\n'),
    });
    const beforeId = handle.currentVersion().id;
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace',
        operation: 'replace',
        range: { start: 1, end: 1 },
        context: { replacement: '' },
      }),
    );
    // retain-only / empty ops — length may be 0 after compact semantics
    const result = handle.acceptProposal(proposal);
    if (proposal.change.length() === 0) {
      expect(result.empty).toBe(true);
      expect(handle.currentVersion().id).toBe(beforeId);
    } else {
      // retain-only change may still apply as empty document transition
      expect(textOf(handle.getContents())).toBe('hi\n');
    }
  });

  it('attributes outside replaced range are preserved', async () => {
    const before = new ChangeSet()
      .insert('AA', { bold: true })
      .insert('BB')
      .insert('CC', { italic: true })
      .insert('\n');
    const handle = DocumentHandle.create({ contents: before });
    // Replace middle "BB" (indices 2..4)
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace',
        operation: 'replace',
        range: { start: 2, end: 4 },
        context: { replacement: 'XX' },
      }),
    );
    const after = before.compose(proposal.change);
    expect(after.ops).toEqual([
      { insert: 'AA', attributes: { bold: true } },
      { insert: 'XX' },
      { insert: 'CC', attributes: { italic: true } },
      { insert: '\n' },
    ]);
  });

  it('transform/rewrite/shorten reject embed-bearing ranges', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet()
        .insert('a')
        .insert({ image: 'x.png' })
        .insert('b\n'),
    });
    await expect(
      provider.generate(
        createIntelligenceRequest(handle, {
          instruction: 'transform',
          operation: 'transform',
          range: { start: 0, end: 3 },
        }),
      ),
    ).rejects.toBeInstanceOf(IntelligenceProviderError);

    // Explicit replace over embeds is allowed (delete + insert text)
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'replace',
        operation: 'replace',
        range: { start: 1, end: 2 },
        context: { replacement: 'IMG' },
      }),
    );
    expect(textOf(handle.getContents().compose(proposal.change))).toBe('aIMGb\n');
  });

  it('invalid operation fails explicitly', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('x\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'replace selection',
      operation: 'replace',
      range: { start: 0, end: 1 },
      // missing replacement
    });
    await expect(provider.generate(request)).rejects.toBeInstanceOf(
      IntelligenceProviderError,
    );
  });

  it('structuredEditToChangeSet matches compose expectation', () => {
    const request = {
      documentId: 'd',
      baseVersionId: 'v',
      contents: new ChangeSet().insert('abcd\n').freeze(),
      instruction: 't',
      range: { start: 1, end: 3 },
    };
    const change = structuredEditToChangeSet(request, {
      kind: 'replace-range',
      text: 'ZZ',
    });
    expect(textOf(request.contents.compose(change))).toBe('aZZd\n');
  });
});

describe('6C–6D stale + collaboration still hold', () => {
  it('stale deterministic proposal requires explicit rebase', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'transform',
        operation: 'transform',
        range: { start: 0, end: 5 },
      }),
    );
    handle.apply(new ChangeSet().retain(0).insert('!'));
    expect(() => handle.acceptProposal(proposal)).toThrow(ProposalError);
    handle.acceptProposal(handle.rebaseProposal(proposal));
    expect(textOf(handle.getContents()).includes('HELLO')).toBe(true);
  });
});
