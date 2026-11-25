#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const https = require('https');
const debug = require('debug')('guess-who:server');

const { app, errorHandler } = require('./app');
const { mountClient } = require('./client');
const addWebsockets = require('./routes/socket');

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
function createServer() {
  const { TLS_KEY, TLS_CERT } = process.env;
  if (TLS_KEY && TLS_CERT) {
    return https.createServer({ key: fs.readFileSync(TLS_KEY), cert: fs.readFileSync(TLS_CERT) }, app);
  }
  if (TLS_KEY || TLS_CERT) {
    throw new Error('Set both TLS_KEY and TLS_CERT, or neither');
  }
  return http.createServer(app);
}

async function main() {
  const server = createServer();

  await mountClient(app, server);
  app.use(errorHandler);
  addWebsockets(server, app);

  server.on('error', onError);
  server.listen(port, host, function() {
    const scheme = server instanceof https.Server ? 'https' : 'http';
    console.log(`Listening on ${scheme}://${host}:${port}`);
    debug('Listening on ' + host + ':' + port);
  });
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) return val; // named pipe
  if (port >= 0) return port;
  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

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
