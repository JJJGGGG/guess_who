const path = require('path');
const fs = require('fs');
const express = require('express');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

// Serves the React client from the same server and origin as the API.
// - dev: Vite runs as middleware, with hot reload over the same HTTP(S) server.
// - production: the prebuilt dist/ folder, with index.html for client routes.
async function mountClient(app, httpServer) {
  if (process.env.NODE_ENV === 'production') {
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error('dist/index.html not found: run `npm run build` first');
    }
    app.use(express.static(dist, { index: false }));
    app.get('/{*splat}', function(req, res) {
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

module.exports = { mountClient };
