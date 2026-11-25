import path from 'path';
import fs from 'fs';
import type http from 'http';
import express from 'express';
import type { Express, Request, Response } from 'express';

const root = path.join(import.meta.dirname, '..');
const dist = path.join(root, 'dist');

// Serves the React client from the same server and origin as the API.
// - dev: Vite runs as middleware, with hot reload over the same HTTP(S) server.
// - production: the prebuilt dist/ folder, with index.html for client routes.
export async function mountClient(app: Express, httpServer: http.Server): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error('dist/index.html not found: run `npm run build` first');
    }
    app.use(express.static(dist, { index: false }));
    app.get('/{*splat}', function(req: Request, res: Response) {
      res.sendFile(path.join(dist, 'index.html'));
    });
    return;
  }

  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.join(root, 'vite.config.mts'),
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
