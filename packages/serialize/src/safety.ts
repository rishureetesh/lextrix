import type ChangeSet from 'lextrix-change';

/** Error thrown when a serialization conversion cannot be performed safely. */
export class SerializationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SerializationError';
    this.code = code;
  }
}

export type ConversionSafety = 'safe' | 'lossy' | 'unsupported';

export interface SafetyIssue {
  feature: string;
  safety: ConversionSafety;
  message: string;
}

/** Detects native editor tables (row-id strings) that cannot export to markdown safely. */
export function findNativeTableCells(delta: ChangeSet): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  delta.ops.forEach((op, index) => {
    const table = op.attributes?.table;
    if (typeof table === 'string' && table.length > 0) {
      issues.push({
        feature: 'table',
        safety: 'unsupported',
        message:
          `ChangeSet op at index ${index} uses native editor table row-id "${table}". ` +
          'Markdown/MDX export cannot represent this table model. ' +
          'Use exportContent("html") instead.',
      });
    }
  });
  return issues;
}

/** Returns unsupported issues that must block export. */
export function validateMarkdownExport(delta: ChangeSet): void {
  const unsupported = findNativeTableCells(delta).filter(
    (issue) => issue.safety === 'unsupported',
  );
  if (unsupported.length > 0) {
    throw new SerializationError(unsupported[0].message, 'TABLE_EXPORT_UNSUPPORTED');
  }
}

const HTML_ONLY_FORMATS: Array<{ attr: string; feature: string; label: string }> =
  [
    { attr: 'color', feature: 'color', label: 'Text color' },
    { attr: 'background', feature: 'background', label: 'Background color' },
    { attr: 'align', feature: 'align', label: 'Alignment' },
    { attr: 'font', feature: 'font', label: 'Font family' },
    { attr: 'size', feature: 'size', label: 'Font size' },
  ];

/** Documents known lossy markdown/MDX conversions without blocking export. */
export function findLossyMarkdownIssues(delta: ChangeSet): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  delta.ops.forEach((op) => {
    if (op.attributes?.bold && op.attributes?.italic) {
      issues.push({
        feature: 'bold+italic',
        safety: 'lossy',
        message:
          'Combined bold and italic may collapse to bold-only on markdown export.',
      });
    }
    for (const { attr, feature, label } of HTML_ONLY_FORMATS) {
      if (op.attributes?.[attr] != null) {
        issues.push({
          feature,
          safety: 'lossy',
          message: `${label} is not exported to Markdown/MDX. Use exportContent('html') or JSON to preserve it.`,
        });
      }
    }
  });

  return dedupeIssues(issues);
}

/** Issues that block markdown/MDX export (e.g. native tables). */
export function findBlockedMarkdownExportIssues(delta: ChangeSet): SafetyIssue[] {
  return findNativeTableCells(delta).filter(
    (issue) => issue.safety === 'unsupported',
  );
}

/** All export warnings for markdown/MDX — call before exportContent to inform users. */
export function getMarkdownExportWarnings(delta: ChangeSet): SafetyIssue[] {
  return dedupeIssues([
    ...findBlockedMarkdownExportIssues(delta),
    ...findLossyMarkdownIssues(delta),
  ]);
}

function dedupeIssues(issues: SafetyIssue[]): SafetyIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.feature}:${issue.safety}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
