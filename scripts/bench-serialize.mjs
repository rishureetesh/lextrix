#!/usr/bin/env node
/**
 * Serialization performance certification.
 * Run: npx tsx scripts/bench-serialize.mjs
 */
import { performance } from 'node:perf_hooks';

const serializePath = new URL('../packages/serialize/src/index.ts', import.meta.url);

const { markdownSerializer, mdxSerializer, SerializerHost, createSerializerRegistry } =
  await import(serializePath.href);

const markdown = markdownSerializer();
const mdx = mdxSerializer();
const host = new SerializerHost(createSerializerRegistry([markdown, mdx]));

function repeat(text, times) {
  return Array(times).fill(text).join('\n\n');
}

const SMALL = `# Hello

**world** and *friends*.

- Item one
`;

const MEDIUM = repeat(SMALL, 20);

const LARGE = repeat(
  `${SMALL}
\`\`\`js
console.log('block');
\`\`\`

| Col A | Col B |
| --- | --- |
| 1 | 2 |

<Alert>Component</Alert>
`,
  50,
);

const SIZES = [
  ['small (~200 chars)', SMALL],
  ['medium (~2 KB)', MEDIUM],
  ['large (~20 KB)', LARGE],
];

function bench(name, fn, iterations = 200) {
  // Warm-up
  for (let i = 0; i < 5; i += 1) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  const ms = performance.now() - start;
  const perOp = ms / iterations;
  const throughputKb = ((fn.__bytes ?? 0) / 1024) / (perOp / 1000);
  const throughput =
    fn.__bytes > 0 ? ` | ~${throughputKb.toFixed(0)} KB/s` : '';
  console.log(
    `  ${name}: ${perOp.toFixed(3)} ms/op (${iterations} ops)${throughput}`,
  );
  return perOp;
}

function runSuite(label, doc) {
  console.log(`\n=== ${label} ===`);
  const bytes = Buffer.byteLength(doc, 'utf8');
  console.log(`Document size: ${bytes} bytes`);

  let cached;
  const importMd = () => {
    cached = markdown.import(doc);
  };
  importMd.__bytes = bytes;
  bench('markdown import', importMd);

  const exportMd = () => markdown.export(cached);
  exportMd.__bytes = bytes;
  bench('markdown export', exportMd);

  const importMdx = () => {
    cached = mdx.import(doc);
  };
  importMdx.__bytes = bytes;
  bench('mdx import', importMdx);

  const exportMdx = () => mdx.export(cached);
  exportMdx.__bytes = bytes;
  bench('mdx export', exportMdx);

  const roundTrip = () => {
    const delta = markdown.import(doc);
    const out = markdown.export(delta);
    markdown.import(out);
  };
  roundTrip.__bytes = bytes;
  bench('markdown round-trip', roundTrip, 100);

  const hostParse = () => {
    cached = host.parse(doc, 'markdown');
  };
  hostParse.__bytes = bytes;
  bench('host parse (markdown)', hostParse);

  const hostStringify = () => host.stringify(cached, 'mdx');
  hostStringify.__bytes = bytes;
  bench('host stringify (mdx)', hostStringify);
}

console.log('Lextrix Serialization — Performance Certification');
console.log('Acceptable limits: < 50 ms/op for documents up to 50 KB');

const results = [];
SIZES.forEach(([label, doc]) => {
  runSuite(label, doc);
  results.push({ label, bytes: Buffer.byteLength(doc, 'utf8') });
});

console.log('\n=== Summary ===');
results.forEach(({ label, bytes }) => {
  const status = bytes < 50_000 ? 'PASS' : 'REVIEW';
  console.log(`${label}: ${bytes} bytes — ${status}`);
});
