const { app, errorHandler } = require('../server/app')
const { fakeIo } = require('./helpers')

// The Express app as server/index.js wires it, minus Vite and real sockets.
app.use(errorHandler)
const io = fakeIo()
app.set('socketio', io)

module.exports = { app, io }
