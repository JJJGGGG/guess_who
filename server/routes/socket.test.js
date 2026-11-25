const http = require('http')
const request = require('supertest')
const { io: connect } = require('socket.io-client')
const { app } = require('../app')
const addWebsockets = require('./socket')
const { sweep, cleanupRooms } = require('./socket')
const { prisma, resetDb, session, createRoom, startedRoom } = require('../../test/helpers')

let server, ws, url
const clients = []

beforeAll(async () => {
  server = http.createServer(app)
  ws = addWebsockets(server, app)
  // sweep/cleanupRooms are called directly below; the timers would race them.
  ws.stop()
  await ws.ready
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  url = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
  ws.io.close()
  await prisma.$disconnect()
})

beforeEach(resetDb)
afterEach(() => {
  clients.splice(0).forEach(c => c.disconnect())
})

function client(token) {
  const c = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true })
  clients.push(c)
  return c
}

function connected(c) {
  return new Promise((resolve, reject) => {
    c.once('connect', () => resolve(c))
    c.once('connect_error', reject)
  })
}

function next(c, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no ' + event)), timeout)
    c.once(event, (payload) => { clearTimeout(t); resolve(payload) })
  })
}

// Collects every `event` the client receives.
function record(c, event) {
  const got = []
  c.on(event, p => got.push(p))
  return got
}

const tick = (ms = 100) => new Promise(r => setTimeout(r, ms))

// Polls until fn() is truthy (DB writes from socket handlers are async).
async function until(fn, timeout = 2000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await tick(25)
  }
  throw new Error('condition not met')
}

describe('handshake', () => {
  test.each([undefined, 'garbage'])('rejects token %p', async (token) => {
    await expect(connected(client(token))).rejects.toThrow('unauthorized')
  })

  test('accepts a valid token', async () => {
    await expect(connected(client(session().token))).resolves.toBeDefined()
  })
})

describe('watch', () => {
  test('lobby watchers get updateRooms', async () => {
    const s = session()
    const c = await connected(client(s.token))
    c.emit('watch', 'lobby')
    await tick()
    const update = next(c, 'updateRooms')
    await request(app).post('/api/rooms').set('Authorization', s.auth)
    expect(await update).toHaveLength(1)
  })

  test('room watchers get updateRoom; switching rooms stops the old one', async () => {
    const a = session(), b = session()
    const room1 = await createRoom(), room2 = await createRoom()
    const spectator = await connected(client(session().token))
    const got = record(spectator, 'updateRoom')

    spectator.emit('watch', room1.id)
    await tick()
    await request(app).post('/api/rooms/join').set('Authorization', a.auth).send({ roomId: room1.id })
    await until(() => got.length === 1)

    spectator.emit('watch', room2.id)
    await tick()
    await request(app).post('/api/rooms/join').set('Authorization', b.auth).send({ roomId: room1.id })
    await tick(200)
    expect(got).toHaveLength(1)
    expect(got[0].id).toBe(room1.id)
  })

  test.each([0, -1, 1.5, '1', 'room:1', null, { id: 1 }])('ignores invalid target %p', async (target) => {
    const c = await connected(client(session().token))
    c.emit('watch', 'lobby')
    c.emit('watch', target)
    await tick()
    const update = next(c, 'updateRooms')
    await request(app).post('/api/rooms').set('Authorization', session().auth)
    await expect(update).resolves.toBeDefined() // still on the lobby
  })
})

describe('private board', () => {
  test('the chosen character only reaches the owner’s sockets', async () => {
    const { room, a, b } = await startedRoom()
    const ownerTab1 = await connected(client(a.token))
    const ownerTab2 = await connected(client(a.token))
    const opponent = await connected(client(b.token))
    const spectator = await connected(client(session().token))
    for (const c of [ownerTab1, ownerTab2, opponent, spectator]) c.emit('watch', room.id)
    await tick()

    const boards = [ownerTab1, ownerTab2, opponent, spectator].map(c => record(c, 'board'))
    const rooms = [opponent, spectator].map(c => record(c, 'updateRoom'))
    await request(app).post('/api/rooms/selectcharacter').set('Authorization', a.auth).send({ roomId: room.id, row: 3, col: 2 })
    await until(() => boards[0].length && boards[1].length && rooms[1].length)
    await tick()

    for (const owner of boards.slice(0, 2)) {
      expect(owner.find(x => x.playerId === a.player.id)).toMatchObject({ chosenRow: 3, chosenCol: 2 })
    }
    expect(boards[2].every(x => x.playerId === b.player.id)).toBe(true)
    expect(boards[3]).toEqual([])
    for (const got of rooms) expect(JSON.stringify(got)).not.toMatch(/chosen/)
  })
})

describe('disconnect / reconnect', () => {
  const board = (s) => prisma.board.findFirst({ where: { playerId: s.player.id } })

  test('marks the board only when the last tab closes, clears it on reconnect', async () => {
    const { a } = await startedRoom()
    const tab1 = await connected(client(a.token))
    const tab2 = await connected(client(a.token))
    // The server marks everyone disconnected on boot; connecting clears it.
    await until(async () => (await board(a)).disconnectedAt === null)

    tab1.disconnect()
    await tick(200)
    expect((await board(a)).disconnectedAt).toBeNull()

    tab2.disconnect()
    await until(async () => (await board(a)).disconnectedAt !== null)

    await connected(client(a.token))
    await until(async () => (await board(a)).disconnectedAt === null)
  })

  test('the opponent sees the disconnect on the room channel', async () => {
    const { room, a, b } = await startedRoom()
    const me = await connected(client(a.token))
    const opponent = await connected(client(b.token))
    opponent.emit('watch', room.id)
    await until(async () => (await board(a)).disconnectedAt === null)

    const update = next(opponent, 'updateRoom')
    me.disconnect()
    const payload = await update
    expect(payload.boards.find(x => x.playerId === a.player.id).disconnectedAt).not.toBeNull()
  })
})

describe('sweep', () => {
  const fakeIo = () => ({ to: () => ({ emit: jest.fn() }) })

  test('removes players past the grace period and resets the room', async () => {
    const { room, a, b } = await startedRoom()
    await prisma.board.updateMany({ data: { chosenRow: 0, chosenCol: 0 } })
    await prisma.board.updateMany({ where: { playerId: a.player.id }, data: { disconnectedAt: new Date(Date.now() - 5000) } })

    await sweep(fakeIo())

    const boards = await prisma.board.findMany({ where: { roomId: room.id }, include: { tiles: true } })
    expect(boards).toHaveLength(1)
    expect(boards[0]).toMatchObject({ playerId: b.player.id, chosenRow: null, tiles: [] })
    expect((await prisma.room.findUnique({ where: { id: room.id } })).started).toBe(false)
  })

  test('keeps players still inside the grace period', async () => {
    const { room, a } = await startedRoom()
    await prisma.board.updateMany({ where: { playerId: a.player.id }, data: { disconnectedAt: new Date() } })
    await sweep(fakeIo())
    expect(await prisma.board.count({ where: { roomId: room.id } })).toBe(2)
    expect(await prisma.tile.count()).toBe(72)
  })
})

describe('cleanupRooms', () => {
  test('deletes old empty rooms with their messages, keeps rooms with players', async () => {
    const s = session()
    const empty = await createRoom()
    const busy = await createRoom([s])
    await prisma.message.create({ data: { roomId: empty.id, playerId: 'x', message: 'bye' } })
    await prisma.room.updateMany({ data: { createdAt: new Date(Date.now() - 60000) } })

    const io = { to: () => ({ emit: jest.fn() }) }
    await cleanupRooms(io)

    expect(await prisma.room.findUnique({ where: { id: empty.id } })).toBeNull()
    expect(await prisma.message.count()).toBe(0)
    expect(await prisma.room.findUnique({ where: { id: busy.id } })).not.toBeNull()
  })
})
