/**
 * Convert structured edits into ChangeSets against request contents/range.
 */
import ChangeSet from 'lextrix-change';
import type { ChangeOp } from 'lextrix-change';
import type { DocumentIntelligenceRequest } from './request.js';
import { extractRequestContext } from './request.js';
import { IntelligenceParseError } from './errors.js';
import type { StructuredEdit } from './structured-provider.js';

export function structuredEditToChangeSet(
  request: DocumentIntelligenceRequest,
  edit: StructuredEdit,
): ChangeSet {
  const ctx = extractRequestContext(request);
  const docLen = request.contents.length();

  switch (edit.kind) {
    case 'replace-range': {
      const start = ctx.range?.start ?? 0;
      const end = ctx.range?.end ?? docLen;
      const del = Math.max(0, end - start);
      // Preserve trailing newline when replacing whole document if present.
      let text = edit.text;
      if (!ctx.range && docLen > 0) {
        const full = ctx.fullText;
        if (full.endsWith('\n') && !text.endsWith('\n')) {
          text = `${text}\n`;
        }
      }
      const cs = new ChangeSet();
      if (start > 0) cs.retain(start);
      if (del > 0) cs.delete(del);
      if (text.length > 0) cs.insert(text);
      const rest = docLen - end;
      if (rest > 0) cs.retain(rest);
      return cs;
    }
    case 'ops': {
      if (!Array.isArray(edit.ops)) {
        throw new IntelligenceParseError('ops edit requires ops array');
      }
      return new ChangeSet(edit.ops as ChangeOp[]);
    }
    default: {
      const _e: never = edit;
      throw new IntelligenceParseError(`Unknown edit kind: ${String(_e)}`);
    }
  }
}
