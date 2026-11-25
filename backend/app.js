var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors')
var helmet = require('helmet')

require('dotenv').config()

// Without this, cors() and socket.io both treat an undefined origin as "allow all".
if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL must be set (see .env.example)')
}

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var roomsRouter = require('./routes/rooms');
var sessionRouter = require('./routes/session');

var app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/rooms', roomsRouter);
app.use('/session', sessionRouter);

app.use(function(req, res) {
  res.status(404).json({ error: 'not found' });
});

// Never send stack traces to the client; keep 4xx statuses from body-parser etc.
app.use(function(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (res.headersSent) return next(err);
  res.status(status).json({ error: status >= 500 ? 'internal' : (err.expose && err.message) || 'bad request' });
});

module.exports = app;
