/**
 * Deterministic proposal producer for Phase 6A tests.
 * Simulates AI / agent output without model providers.
 * Lives under testing/ — not part of the Document engine API.
 */
import ChangeSet from '../change/change-set.js';
import {
  createChangeProposal,
  type ChangeProposal,
} from '../experimental/proposal.js';
import type { DocumentVersion } from '../experimental/version.js';
import type { ChangeMeta } from '../experimental/change-meta.js';

export type DeterministicScenario =
  | 'append-world'
  | 'replace-quick-fast'
  | 'insert-prefix'
  | 'delete-first-char';

/**
 * Builds version-bound ChangeProposals with `source: 'ai'` for architecture tests.
 * Not an LLM. Not exported from `lextrix-change/experimental`.
 */
export class DeterministicProposalGenerator {
  constructor(
    private readonly defaults: {
      explanation?: string;
      model?: string;
      provider?: string;
    } = {},
  ) {}

  generate(
    version: DocumentVersion,
    scenario: DeterministicScenario = 'append-world',
    extraMeta: Partial<ChangeMeta> = {},
  ): ChangeProposal {
    const change = this.buildChange(version, scenario);
    return createChangeProposal({
      documentId: version.documentId,
      baseVersionId: version.id,
      change,
      meta: {
        source: 'ai',
        origin: 'system',
        intent: scenario,
        explanation: this.defaults.explanation ?? `deterministic:${scenario}`,
        model: this.defaults.model ?? 'deterministic-v1',
        provider: this.defaults.provider ?? 'test-fixture',
        ...extraMeta,
      },
    });
  }

  private buildChange(
    version: DocumentVersion,
    scenario: DeterministicScenario,
  ): ChangeSet {
    const text = documentText(version.contents);
    switch (scenario) {
      case 'append-world': {
        // Insert before trailing newline when present.
        const at = text.endsWith('\n') ? text.length - 1 : text.length;
        const cs = new ChangeSet();
        if (at > 0) cs.retain(at);
        cs.insert(at === 0 || text === '\n' ? 'Hello world' : ' world');
        const rest = version.contents.length() - at;
        if (rest > 0) cs.retain(rest);
        return cs;
      }
      case 'replace-quick-fast': {
        const idx = text.indexOf('quick');
        if (idx < 0) {
          // Fallback: append marker
          const at = Math.max(0, version.contents.length() - 1);
          return new ChangeSet().retain(at).insert('[fast]');
        }
        return new ChangeSet()
          .retain(idx)
          .delete(5)
          .insert('fast')
          .retain(version.contents.length() - idx - 5);
      }
      case 'insert-prefix': {
        return new ChangeSet()
          .insert('>>')
          .retain(version.contents.length());
      }
      case 'delete-first-char': {
        if (version.contents.length() <= 1) {
          return new ChangeSet().retain(version.contents.length());
        }
        return new ChangeSet()
          .delete(1)
          .retain(version.contents.length() - 1);
      }
      default: {
        const _exhaustive: never = scenario;
        throw new Error(`Unknown scenario: ${_exhaustive}`);
      }
    }
  }
}

function documentText(contents: ChangeSet): string {
  let text = '';
  for (const op of contents.ops) {
    if (typeof op.insert === 'string') text += op.insert;
  }
  return text;
}
