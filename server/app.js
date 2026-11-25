var express = require('express');
var logger = require('morgan');
var helmet = require('helmet')

require('dotenv').config()

var indexRouter = require('./routes/index');
var roomsRouter = require('./routes/rooms');
var sessionRouter = require('./routes/session');

const isProduction = process.env.NODE_ENV === 'production'

var app = express();
app.disable('x-powered-by');
// Render / AWS terminate TLS at their load balancer; trust one hop so req.ip
// and req.protocol describe the real client.
if (isProduction) app.set('trust proxy', 1);
// Vite's dev page injects an inline React-refresh script, so CSP is only
// enforced on the built client, which has no inline scripts.
app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

app.use(logger('dev'));

// Everything under /api is JSON. The prefix keeps API routes (e.g. /api/rooms)
// apart from client pages (e.g. /rooms/:roomId), which share the same origin.
var api = express.Router();
api.use(express.json());
api.use(express.urlencoded({ extended: false }));
api.use('/', indexRouter);
api.use('/rooms', roomsRouter);
api.use('/session', sessionRouter);
api.use(function(req, res) {
  res.status(404).json({ error: 'not found' });
});
app.use('/api', api);

// Never send stack traces to the client; keep 4xx statuses from body-parser etc.
// Added by server/index.js after the client is mounted, so it is registered last.
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (res.headersSent) return next(err);
  res.status(status).json({ error: status >= 500 ? 'internal' : (err.expose && err.message) || 'bad request' });
}

module.exports = { app, errorHandler };
