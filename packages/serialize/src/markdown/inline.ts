import ChangeSet from 'lextrix-change';
import type { ChangeOp } from 'lextrix-change';

const INLINE_ORDER = ['link', 'bold', 'italic', 'strike', 'code', 'underline'] as const;

const FORMAT_MARKERS: Record<string, [string, string]> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  code: ['`', '`'],
  underline: ['<u>', '</u>'],
};

/** Escapes markdown special characters in plain text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');
}

/** Converts inline ChangeSet ops to markdown text. */
export function inlineOpsToMarkdown(ops: ChangeOp[]): string {
  return ops.reduce((result, op) => {
    if (typeof op.insert === 'object' && op.insert !== null) {
      const key = Object.keys(op.insert)[0];
      if (key === 'image') {
        const src = String(op.insert[key]);
        const alt = (op.attributes?.alt as string) ?? '';
        return `${result}![${alt}](${src})`;
      }
      if (key === 'video') {
        return `${result}[video](${String(op.insert[key])})`;
      }
      return result;
    }

    if (typeof op.insert !== 'string') return result;

    let text = escapeMarkdown(op.insert);
    const attrs = op.attributes ?? {};

    if (attrs.link) {
      return `${result}[${text}](${String(attrs.link)})`;
    }

    for (const format of INLINE_ORDER) {
      if (format === 'link') continue;
      if (attrs[format]) {
        const [open, close] = FORMAT_MARKERS[format];
        text = `${open}${text}${close}`;
      }
    }

    return result + text;
  }, '');
}

interface InlineToken {
  text: string;
  formats: Record<string, unknown>;
}

/** Parses inline markdown into ChangeSet insert ops. */
export function parseInlineMarkdown(text: string): ChangeOp[] {
  return inlineTokensToOps(tokenizeInline(text));
}

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;

  while (i < text.length) {
    const imageMatch = text.slice(i).match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      tokens.push({
        text: imageMatch[2],
        formats: { _embed: 'image', _alt: imageMatch[1] },
      });
      i += imageMatch[0].length;
      continue;
    }

    const linkMatch = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push({ text: linkMatch[1], formats: { link: linkMatch[2] } });
      i += linkMatch[0].length;
      continue;
    }

    const codeMatch = text.slice(i).match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push({ text: codeMatch[1], formats: { code: true } });
      i += codeMatch[0].length;
      continue;
    }

    const boldMatch = text.slice(i).match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      tokens.push({ text: boldMatch[1], formats: { bold: true } });
      i += boldMatch[0].length;
      continue;
    }

    const strikeMatch = text.slice(i).match(/^~~([^~]+)~~/);
    if (strikeMatch) {
      tokens.push({ text: strikeMatch[1], formats: { strike: true } });
      i += strikeMatch[0].length;
      continue;
    }

    const italicMatch = text.slice(i).match(/^\*([^*]+)\*/);
    if (italicMatch) {
      tokens.push({ text: italicMatch[1], formats: { italic: true } });
      i += italicMatch[0].length;
      continue;
    }

    const nextSpecial = text.slice(i).search(/[!\\[*`~]/);
    const end = nextSpecial === -1 ? text.length : i + nextSpecial;
    if (end > i) {
      tokens.push({ text: text.slice(i, end), formats: {} });
      i = end;
    } else {
      tokens.push({ text: text[i], formats: {} });
      i += 1;
    }
  }

  return mergeAdjacentTokens(tokens);
}

function mergeAdjacentTokens(tokens: InlineToken[]): InlineToken[] {
  return tokens.reduce<InlineToken[]>((merged, token) => {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      JSON.stringify(prev.formats) === JSON.stringify(token.formats) &&
      !token.formats._embed
    ) {
      prev.text += token.text;
      return merged;
    }
    merged.push({ ...token });
    return merged;
  }, []);
}

/** Converts inline tokens to ChangeSet ops, resolving embeds. */
export function inlineTokensToOps(tokens: InlineToken[]): ChangeOp[] {
  const ops: ChangeOp[] = [];
  tokens.forEach((token) => {
    if (token.formats._embed === 'image') {
      ops.push({
        insert: { image: token.text },
        attributes: token.formats._alt
          ? { alt: token.formats._alt as string }
          : undefined,
      });
      return;
    }
    const { _embed: _, _alt: __, ...formats } = token.formats;
    ops.push({
      insert: token.text,
      attributes: Object.keys(formats).length > 0 ? formats : undefined,
    });
  });
  return ops;
}

/** Builds a single-block ChangeSet from inline markdown. */
export function markdownInlineToChangeSet(text: string): ChangeSet {
  const tokens = tokenizeInline(text);
  const ops = inlineTokensToOps(tokens);
  return ops.reduce(
    (delta, op) => delta.insert(op.insert!, op.attributes),
    new ChangeSet(),
  );
}
