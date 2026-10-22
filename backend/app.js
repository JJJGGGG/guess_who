var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors')

require('dotenv').config()

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var roomsRouter = require('./routes/rooms');
var sessionRouter = require('./routes/session');

var app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL,
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

console.log(process.env.FRONTEND_URL)

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/rooms', roomsRouter);
app.use('/session', sessionRouter);


module.exports = app;
