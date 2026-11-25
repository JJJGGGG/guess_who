var express = require('express');
var logger = require('morgan');
var helmet = require('helmet')
var { rateLimit } = require('express-rate-limit')
var { Prisma } = require('@prisma/client')

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

if (process.env.NODE_ENV !== 'test') app.use(logger('dev'));

// Everything under /api is JSON. The prefix keeps API routes (e.g. /api/rooms)
// apart from client pages (e.g. /rooms/:roomId), which share the same origin.
// Per-IP limits per minute (req.ip is the client thanks to 'trust proxy').
// In memory, so per process and reset on restart; see finding #19.
function limiter(envName, fallback, options = {}) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: parseInt(process.env[envName]) || fallback,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'too many requests' }),
    ...options
  });
}

var api = express.Router();
api.use(limiter('RATE_LIMIT_WRITES_PER_MIN', 120, { skip: (req) => req.method === 'GET' }));
api.post('/session', limiter('RATE_LIMIT_SESSIONS_PER_MIN', 10));
api.post('/rooms', limiter('RATE_LIMIT_ROOMS_PER_MIN', 5));
api.post('/rooms/message', limiter('RATE_LIMIT_MESSAGES_PER_MIN', 30));
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
  // A request field of the wrong type (e.g. roomId: "abc") reaches Prisma as an
  // invalid query. That is the client's fault, so answer 400, not 500.
  const status = err instanceof Prisma.PrismaClientValidationError
    ? 400
    : err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (res.headersSent) return next(err);
  res.status(status).json({ error: status >= 500 ? 'internal' : (err.expose && err.message) || 'bad request' });
}

module.exports = { app, errorHandler };
