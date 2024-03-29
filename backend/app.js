var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors')

require('dotenv').config()

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var roomsRouter = require('./routes/rooms');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: process.env.FRONTEND_URL,
}))

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/rooms', roomsRouter);


module.exports = app;
