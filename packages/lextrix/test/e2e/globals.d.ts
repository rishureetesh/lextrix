interface LextrixE2E {
  clipboard: { convert(args: { html: string; text: string }): unknown };
  setContents(delta: unknown): void;
  getSelection(): unknown;
  setSelection(range: unknown): void;
  history: { cutoff(): void; options: { userOnly: boolean } };
  updateContents(delta: unknown, source: string): void;
  getContents(): { ops: unknown[] };
  exportContent(
    format: string | { format: string; index: number; length: number },
  ): string;
  importContent(content: string, format: string): void;
  getSemanticHTML(): string;
  getText(): string;
}

interface Window {
  lextrix: LextrixE2E;
}
