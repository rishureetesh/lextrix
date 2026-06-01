import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';

const lextrixDist = resolve(__dirname, '../lextrix/dist/dist');

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
