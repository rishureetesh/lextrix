import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';

const lextrixDist = resolve(__dirname, '../lextrix/dist/dist');
const changeSrc = resolve(__dirname, '../change/src');
const collabSrc = resolve(__dirname, '../collab/src');
const intelSrc = resolve(__dirname, '../intelligence/src');

function serveFile(res, file, type) {
  if (!existsSync(file)) {
    res.statusCode = 404;
    res.end('Build lextrix first: npm run build');
    return;
  }
  res.setHeader('Content-Type', type);
  createReadStream(file).pipe(res);
}

export default defineConfig({
  root: __dirname,
  server: { port: 5173, fs: { allow: ['..'] } },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'lextrix-change/experimental': resolve(changeSrc, 'experimental/index.ts'),
      'lextrix-change/document': resolve(changeSrc, 'document/index.ts'),
      'lextrix-change/persistence/authority-memory': resolve(
        changeSrc,
        'persistence/authority-memory.ts',
      ),
      'lextrix-change/persistence/lifecycle': resolve(
        changeSrc,
        'persistence/lifecycle.ts',
      ),
      'lextrix-change/persistence': resolve(changeSrc, 'persistence/index.ts'),
      'lextrix-change/collaboration': resolve(changeSrc, 'collaboration/index.ts'),
      'lextrix-change/wire': resolve(changeSrc, 'wire/index.ts'),
      'lextrix-change': resolve(changeSrc, 'index.ts'),
      'lextrix-collab': resolve(collabSrc, 'index.ts'),
      'lextrix-intelligence/openai': resolve(intelSrc, 'openai/index.ts'),
      'lextrix-intelligence': resolve(intelSrc, 'index.ts'),
      // Snapshot hashing uses node:crypto in the engine; browser demos avoid that module.
      'node:crypto': resolve(__dirname, 'src/crypto-browser-shim.js'),
    },
  },
  optimizeDeps: {
    exclude: [
      'lextrix-change',
      'lextrix-collab',
      'lextrix-intelligence',
    ],
  },
  plugins: [
    {
      name: 'lextrix-dist',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/lextrix.js') {
            return serveFile(res, resolve(lextrixDist, 'lextrix.js'), 'text/javascript');
          }
          const cssThemes = ['snow', 'bubble', 'slate', 'dawn'];
          for (const theme of cssThemes) {
            if (req.url === `/lextrix.${theme}.css`) {
              return serveFile(
                res,
                resolve(lextrixDist, `lextrix.${theme}.css`),
                'text/css',
              );
            }
          }
          next();
        });
      },
    },
  ],
});
