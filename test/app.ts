import { app, errorHandler } from '../server/app.ts'
import { fakeIo } from './helpers.ts'

// The Express app as server/index.ts wires it, minus Vite and real sockets.
app.use(errorHandler)
const io = fakeIo()
app.set('socketio', io)

export { app, io }
