import { describe, expect, test } from 'vitest';
import {
  changeSetToMarkdown,
  markdownSerializer,
} from 'lextrix-serialize';

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'hello', 'world'];

function randomParagraph(): string {
  const count = 1 + Math.floor(Math.random() * 4);
  const words = Array.from({ length: count }, () =>
    WORDS[Math.floor(Math.random() * WORDS.length)],
  );
  let text = words.join(' ');
  if (Math.random() > 0.5) {
    const i = Math.floor(Math.random() * words.length);
    words[i] = `**${words[i]}**`;
    text = words.join(' ');
  }
  return text;
}

function randomMarkdown(): string {
  const blocks: string[] = [];
  const blockCount = 1 + Math.floor(Math.random() * 5);
  for (let i = 0; i < blockCount; i += 1) {
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) {
      const level = 1 + Math.floor(Math.random() * 3);
      blocks.push(`${'#'.repeat(level)} ${randomParagraph()}`);
    } else if (kind === 1) {
      blocks.push(`> ${randomParagraph()}`);
    } else {
      blocks.push(randomParagraph());
    }
  }
  return blocks.join('\n\n');
}

describe('property: markdown round-trip', () => {
  test('50 random documents survive export → import → export', () => {
    for (let i = 0; i < 50; i += 1) {
      const source = randomMarkdown();
      const serializer = markdownSerializer();
      const delta = serializer.import(source);
      const exported = changeSetToMarkdown(delta);
      const delta2 = serializer.import(exported);
      const exported2 = changeSetToMarkdown(delta2);
      expect(exported2).toBe(exported);
    }
  });
});
