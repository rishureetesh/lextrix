import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';

const lextronDist = resolve(__dirname, '../lextron/dist/dist');

function serveFile(res, file, type) {
  if (!existsSync(file)) {
    res.statusCode = 404;
    res.end('Build lextron first: npm run build');
    return;
  }
  res.setHeader('Content-Type', type);
  createReadStream(file).pipe(res);
}

export default defineConfig({
  root: __dirname,
  server: { port: 5173, fs: { allow: ['..'] } },
  plugins: [
    {
      name: 'lextron-dist',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/lextron.js') {
            return serveFile(res, resolve(lextronDist, 'lextron.js'), 'text/javascript');
          }
          const cssThemes = ['snow', 'bubble', 'slate', 'dawn'];
          for (const theme of cssThemes) {
            if (req.url === `/lextron.${theme}.css`) {
              return serveFile(
                res,
                resolve(lextronDist, `lextron.${theme}.css`),
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
