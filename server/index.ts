#!/usr/bin/env node

import fs from 'fs';
import http from 'http';
import https from 'https';
import createDebug from 'debug';

import { app, errorHandler } from './app.ts';
import { mountClient } from './client.ts';
import addWebsockets from './routes/socket.ts';

const debug = createDebug('guess-who:server');

const isProduction = process.env.NODE_ENV === 'production';
const port = normalizePort(process.env.PORT || '3000');
// Render / AWS need 0.0.0.0. In dev, stay on loopback unless HOST says otherwise
// (set HOST=0.0.0.0 to test from other devices on the LAN).
const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
app.set('port', port);

/**
 * In production TLS is terminated by the platform's load balancer, which
 * forwards plain HTTP. For LAN testing, set TLS_KEY and TLS_CERT (e.g. mkcert
 * files outside the repo) and Node serves HTTPS itself.
 */
function createServer(): http.Server {
  const { TLS_KEY, TLS_CERT } = process.env;
  if (TLS_KEY && TLS_CERT) {
    return https.createServer({ key: fs.readFileSync(TLS_KEY), cert: fs.readFileSync(TLS_CERT) }, app);
  }
  if (TLS_KEY || TLS_CERT) {
    throw new Error('Set both TLS_KEY and TLS_CERT, or neither');
  }
  return http.createServer(app);
}

async function main(): Promise<void> {
  const server = createServer();

  await mountClient(app, server);
  app.use(errorHandler);
  addWebsockets(server, app);

  server.on('error', onError);
  // A named pipe (string port) has no host.
  const onListening = function() {
    const scheme = server instanceof https.Server ? 'https' : 'http';
    console.log(`Listening on ${scheme}://${host}:${port}`);
    debug('Listening on ' + host + ':' + port);
  };
  if (typeof port === 'number') {
    server.listen(port, host, onListening);
  } else {
    server.listen(port, onListening);
  }
}

// Last resort for promises nobody awaits or catches (e.g. a socket handler).
// Log and keep serving; Node would otherwise exit the whole process.
process.on('unhandledRejection', function(reason) {
  console.error('Unhandled rejection:', reason);
});

main().catch(function(err: unknown) {
  console.error(err);
  process.exit(1);
});

/**
 * Normalize a port into a number or a named pipe string.
 */
function normalizePort(val: string): number | string {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val; // named pipe
  if (port >= 0) return port;
  throw new Error('Invalid PORT: ' + val);
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}
