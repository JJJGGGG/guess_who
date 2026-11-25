import 'dotenv/config'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import logger from 'morgan'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import type { Options } from 'express-rate-limit'
import { Prisma } from '@prisma/client'

import indexRouter from './routes/index.ts'
import roomsRouter from './routes/rooms.ts'
import sessionRouter from './routes/session.ts'

const isProduction = process.env.NODE_ENV === 'production'

export const app = express();
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
function limiter(envName: string, fallback: number, options: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: parseInt(process.env[envName] ?? '') || fallback,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req: Request, res: Response) => res.status(429).json({ error: 'too many requests' }),
    ...options
  });
}

const api = express.Router();
api.use(limiter('RATE_LIMIT_WRITES_PER_MIN', 120, { skip: (req) => req.method === 'GET' }));
api.post('/session', limiter('RATE_LIMIT_SESSIONS_PER_MIN', 10));
api.post('/rooms', limiter('RATE_LIMIT_ROOMS_PER_MIN', 5));
api.post('/rooms/message', limiter('RATE_LIMIT_MESSAGES_PER_MIN', 30));
api.use(express.json());
api.use(express.urlencoded({ extended: false }));
api.use('/', indexRouter);
api.use('/rooms', roomsRouter);
api.use('/session', sessionRouter);
api.use(function(req: Request, res: Response) {
  res.status(404).json({ error: 'not found' });
});
app.use('/api', api);

// What body-parser, http-errors etc. put on the errors they throw.
type HttpError = Error & { status?: number, statusCode?: number, expose?: boolean }

// Never send stack traces to the client; keep 4xx statuses from body-parser etc.
// Added by server/index.ts after the client is mounted, so it is registered last.
export function errorHandler(err: HttpError, req: Request, res: Response, next: NextFunction): void {
  // A request field of the wrong type (e.g. roomId: "abc") reaches Prisma as an
  // invalid query. That is the client's fault, so answer 400, not 500.
  const status = err instanceof Prisma.PrismaClientValidationError
    ? 400
    : err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (res.headersSent) return next(err);
  res.status(status).json({ error: status >= 500 ? 'internal' : (err.expose && err.message) || 'bad request' });
}
