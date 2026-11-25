import request from 'supertest'
import type { Express } from 'express'
import type { PublicBoard, RoomSummary, ChatMessage } from '../../shared/types.ts'
import { app, io } from '../../test/app.ts'
import { prisma, resetDb, session, createRoom, startedRoom } from '../../test/helpers.ts'
import type { Session } from '../../test/helpers.ts'

beforeEach(async () => {
  await resetDb()
  io.emitted.length = 0
})
afterAll(() => prisma.$disconnect())

const post = (path: string, s: Session | null, body?: object) => {
  const req = request(app).post('/api/rooms' + path)
  if (s) req.set('Authorization', s.auth)
  return req.send(body)
}
const boardsIn = (roomId: number) => prisma.board.findMany({ where: { roomId }, include: { tiles: true } })

describe('GET /api/rooms', () => {
  test('lists rooms with players only, no game state', async () => {
    const a = session('alice')
    const { room } = await startedRoom()
    await createRoom([a])
    const res = await request(app).get('/api/rooms')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    const started = res.body.find((r: RoomSummary) => r.id === room.id)
    expect(Object.keys(started.boards[0]).sort()).toEqual(['id', 'playerId', 'playerName'])
  })
})

describe('POST /api/rooms', () => {
  test('401 without a session', async () => {
    expect((await post('', null)).status).toBe(401)
  })

  test('creates a room and updates the lobby', async () => {
    const res = await post('', session())
    expect(res.status).toBe(200)
    expect(await prisma.room.findUnique({ where: { id: res.body.id } })).not.toBeNull()
    const [lobby] = io.sentTo('lobby', 'updateRooms')
    expect(lobby.payload.map((r: RoomSummary) => r.id)).toContain(res.body.id)
  })

  test('503 once MAX_OPEN_ROOMS (5 in tests) is reached', async () => {
    const s = session()
    for (let i = 0; i < 5; i++) expect((await post('', s)).status).toBe(200)
    const res = await post('', s)
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: 'too many rooms' })
  })
})

describe('POST /api/rooms/join', () => {
  test('401 without a session', async () => {
    const room = await createRoom()
    expect((await post('/join', null, { roomId: room.id })).status).toBe(401)
  })

  test.each([{}, { roomId: 'abc' }, { roomId: -1 }, { roomId: 1.5 }, { roomId: { gt: 0 } }])('400 for %p', async (body) => {
    expect((await post('/join', session(), body)).status).toBe(400)
  })

  test('404 for an unknown room', async () => {
    expect((await post('/join', session(), { roomId: 999999 })).status).toBe(404)
  })

  test('first two players get slots 0 and 1, named from their session', async () => {
    const room = await createRoom()
    const a = session('alice'), b = session('bob')
    expect((await post('/join', a, { roomId: room.id })).body).toMatchObject({ slot: 0, playerName: 'alice', playerId: a.player.id })
    expect((await post('/join', b, { roomId: room.id })).body).toMatchObject({ slot: 1, playerName: 'bob' })
    expect(io.sentTo('room:' + room.id, 'updateRoom')).not.toHaveLength(0)
  })

  test('400 when already in the room or when it is full', async () => {
    const a = session(), b = session()
    const room = await createRoom([a, b])
    expect((await post('/join', a, { roomId: room.id })).status).toBe(400)
    expect((await post('/join', session(), { roomId: room.id })).status).toBe(400)
  })

  // Simultaneous joins all read the same free slot, so the unique index lets one
  // through and the rest get 409 even if a seat is left; they can retry. What
  // must hold is that a room never gets more than two boards or a reused slot.
  test('concurrent joins never put a third player in the room', async () => {
    const room = await createRoom()
    const results = await Promise.all([session(), session(), session(), session()].map(s => post('/join', s, { roomId: room.id })))
    const ok = results.filter(r => r.status === 200)
    expect(ok.length).toBeGreaterThanOrEqual(1)
    results.filter(r => r.status !== 200).forEach(r => expect([400, 409]).toContain(r.status))
    const boards = await boardsIn(room.id)
    expect(boards).toHaveLength(ok.length)
    expect(boards.length).toBeLessThanOrEqual(2)
    expect(new Set(boards.map(b => b.slot)).size).toBe(boards.length)
  })

  test('a room that has one player accepts exactly one of several concurrent joins', async () => {
    const room = await createRoom([session()])
    const results = await Promise.all([session(), session(), session()].map(s => post('/join', s, { roomId: room.id })))
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await boardsIn(room.id)).toHaveLength(2)
  })

  test('the same player joining twice concurrently gets one board', async () => {
    const room = await createRoom()
    const a = session()
    await Promise.all([post('/join', a, { roomId: room.id }), post('/join', a, { roomId: room.id })])
    expect(await boardsIn(room.id)).toHaveLength(1)
  })
})

describe('POST /api/rooms/leave', () => {
  test('404 for an unknown room', async () => {
    expect((await post('/leave', session(), { roomId: 999999 })).status).toBe(404)
  })

  test('403 for someone who is not in the room', async () => {
    const { room } = await startedRoom()
    expect((await post('/leave', session(), { roomId: room.id })).status).toBe(403)
    expect(await boardsIn(room.id)).toHaveLength(2)
  })

  test('removes the player and resets the game for the opponent', async () => {
    const { room, a, b } = await startedRoom()
    await prisma.board.updateMany({ data: { chosenRow: 1, chosenCol: 1 } })
    expect((await post('/leave', a, { roomId: room.id })).status).toBe(200)

    const boards = await boardsIn(room.id)
    expect(boards).toHaveLength(1)
    expect(boards[0]).toMatchObject({ playerId: b.player.id, chosenRow: null, chosenCol: null, tiles: [] })
    expect((await prisma.room.findUnique({ where: { id: room.id } }))!.started).toBe(false)
  })
})

describe('POST /api/rooms/start', () => {
  test('403 for a non-member or an unknown room', async () => {
    const a = session(), b = session()
    const room = await createRoom([a, b])
    expect((await post('/start', session(), { roomId: room.id })).status).toBe(403)
    expect((await post('/start', a, { roomId: 999999 })).status).toBe(403)
  })

  test('does not start with one player', async () => {
    const a = session()
    const room = await createRoom([a])
    expect((await post('/start', a, { roomId: room.id })).body).toEqual({ started: false })
    expect(await prisma.tile.count()).toBe(0)
  })

  test('creates a 6x6 board for each player and notifies only them', async () => {
    const a = session(), b = session()
    const room = await createRoom([a, b])
    expect((await post('/start', a, { roomId: room.id })).body).toEqual({ started: true })

    for (const board of await boardsIn(room.id)) {
      expect(board.tiles).toHaveLength(36)
      expect(new Set(board.tiles.map(t => `${t.row},${t.col}`)).size).toBe(36)
    }
    const [start] = io.emitted.filter(e => e.event === 'startGame')
    expect(start.to.sort()).toEqual(['player:' + a.player.id, 'player:' + b.player.id].sort())
    expect(start.payload).toBe(room.id)
  })

  test('a second start does nothing', async () => {
    const a = session(), b = session()
    const room = await createRoom([a, b])
    await post('/start', a, { roomId: room.id })
    expect((await post('/start', b, { roomId: room.id })).body).toEqual({ started: false })
    expect(await prisma.tile.count()).toBe(72)
  })

  test('parallel starts create the tiles once', async () => {
    const a = session(), b = session()
    const room = await createRoom([a, b])
    const results = await Promise.all([post('/start', a, { roomId: room.id }), post('/start', b, { roomId: room.id }), post('/start', a, { roomId: room.id })])
    expect(results.map(r => r.status)).toEqual([200, 200, 200])
    expect(results.filter(r => r.body.started)).toHaveLength(1)
    expect(await prisma.tile.count()).toBe(72)
  })
})

describe('POST /api/rooms/tiles/flip', () => {
  test('403 for a non-member', async () => {
    const { room } = await startedRoom()
    expect((await post('/tiles/flip', session(), { roomId: room.id, row: 0, col: 0 })).status).toBe(403)
  })

  test.each([{ row: 6, col: 0 }, { row: 0, col: -1 }, { row: 'a', col: 0 }, { row: 0 }])('400 for %p', async (cell) => {
    const { room, a } = await startedRoom()
    expect((await post('/tiles/flip', a, { roomId: room.id, ...cell })).status).toBe(400)
  })

  test('400 before the game has tiles', async () => {
    const a = session(), b = session()
    const room = await createRoom([a, b])
    expect((await post('/tiles/flip', a, { roomId: room.id, row: 0, col: 0 })).status).toBe(400)
  })

  test('toggles only the caller’s own tile', async () => {
    const { room, a, b } = await startedRoom()
    const flip = () => post('/tiles/flip', a, { roomId: room.id, row: 2, col: 3 })
    expect((await flip()).body).toMatchObject({ row: 2, col: 3, flipped: true })

    const flipped = await prisma.tile.findMany({ where: { flipped: true }, include: { board: true } })
    expect(flipped).toHaveLength(1)
    expect(flipped[0].board.playerId).toBe(a.player.id)
    expect(b.player.id).not.toBe(a.player.id)

    expect((await flip()).body.flipped).toBe(false)
  })

  test('counts as activity, postponing the idle cleanup', async () => {
    const { room, a } = await startedRoom()
    const old = new Date(Date.now() - 60 * 60000)
    await prisma.room.update({ where: { id: room.id }, data: { lastActivityAt: old } })
    await post('/tiles/flip', a, { roomId: room.id, row: 0, col: 0 }).expect(200)
    const { lastActivityAt } = (await prisma.room.findUnique({ where: { id: room.id } }))!
    expect(lastActivityAt.getTime()).toBeGreaterThan(old.getTime())
  })
})

describe('POST /api/rooms/selectcharacter', () => {
  test('403 for a non-member', async () => {
    const { room } = await startedRoom()
    expect((await post('/selectcharacter', session(), { roomId: room.id, row: 0, col: 0 })).status).toBe(403)
  })

  test.each([{ row: 6, col: 0 }, { row: 0, col: 6 }, { row: -1, col: 0 }, { row: 1.5, col: 0 }])('400 for %p', async (cell) => {
    const { room, a } = await startedRoom()
    expect((await post('/selectcharacter', a, { roomId: room.id, ...cell })).status).toBe(400)
  })

  test('sets the character once; changing it is refused', async () => {
    const { room, a } = await startedRoom()
    expect((await post('/selectcharacter', a, { roomId: room.id, row: 4, col: 5 })).body).toMatchObject({ chosenRow: 4, chosenCol: 5 })
    expect((await post('/selectcharacter', a, { roomId: room.id, row: 0, col: 0 })).status).toBe(409)
    expect(await prisma.board.findFirst({ where: { playerId: a.player.id } })).toMatchObject({ chosenRow: 4, chosenCol: 5 })
  })

  test('parallel selections: exactly one wins', async () => {
    const { room, a } = await startedRoom()
    const results = await Promise.all([0, 1, 2, 3].map(col => post('/selectcharacter', a, { roomId: room.id, row: 0, col })))
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(results.filter(r => r.status === 409)).toHaveLength(3)
  })

  test('the chosen character never goes out on the public room channel', async () => {
    const { room, a } = await startedRoom()
    await post('/selectcharacter', a, { roomId: room.id, row: 4, col: 5 })
    await new Promise(r => setTimeout(r, 50)) // updateRoom runs after the response
    const pub = io.sentTo('room:' + room.id, 'updateRoom')
    expect(pub.length).toBeGreaterThan(0)
    pub.forEach(e => expect(JSON.stringify(e.payload)).not.toMatch(/chosen/))
    const priv = io.sentTo('player:' + a.player.id, 'board')
    expect(priv[priv.length - 1].payload).toMatchObject({ chosenRow: 4, chosenCol: 5 })
  })
})

describe('GET /api/rooms/:id and /:id/board', () => {
  test('400 / 404 for bad or unknown ids', async () => {
    expect((await request(app).get('/api/rooms/abc')).status).toBe(400)
    expect((await request(app).get('/api/rooms/999999')).status).toBe(404)
  })

  test('public room never includes a chosen character', async () => {
    const { room, a } = await startedRoom()
    await post('/selectcharacter', a, { roomId: room.id, row: 4, col: 5 })
    const res = await request(app).get('/api/rooms/' + room.id)
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toMatch(/chosen/)
    expect(res.body.boards.find((b: PublicBoard) => b.playerId === a.player.id).ready).toBe(true)
  })

  test('own board: 401 anonymous, 404 for non-members, chosen character for the owner', async () => {
    const { room, a } = await startedRoom()
    await post('/selectcharacter', a, { roomId: room.id, row: 4, col: 5 })
    expect((await request(app).get(`/api/rooms/${room.id}/board`)).status).toBe(401)
    expect((await request(app).get(`/api/rooms/${room.id}/board`).set('Authorization', session().auth)).status).toBe(404)
    const res = await request(app).get(`/api/rooms/${room.id}/board`).set('Authorization', a.auth)
    expect(res.body).toMatchObject({ playerId: a.player.id, chosenRow: 4, chosenCol: 5 })
    expect(res.body.tiles).toHaveLength(36)
  })
})

describe('messages', () => {
  test('403 for a non-member', async () => {
    const { room } = await startedRoom()
    expect((await post('/message', session(), { roomId: room.id, message: 'hi' })).status).toBe(403)
  })

  test.each(['', '   ', 'x'.repeat(501), { a: 1 }, ['a']])('400 for message %p', async (message) => {
    const { room, a } = await startedRoom()
    expect((await post('/message', a, { roomId: room.id, message })).status).toBe(400)
  })

  test('stores a trimmed message with the session name and broadcasts it', async () => {
    const { room, a } = await startedRoom()
    const res = await post('/message', a, { roomId: room.id, message: '  hello  ', playerName: 'spoofed' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual([expect.objectContaining({ message: 'hello', playerName: 'alice', playerId: a.player.id })])
    const [chat] = io.sentTo('room:' + room.id, 'updateChat')
    expect(chat.payload).toEqual({ rid: room.id, newMessage: 'hello', playerId: a.player.id, playerName: 'alice' })
  })

  test('keeps at most 200 messages per room', async () => {
    const { room, a } = await startedRoom()
    await prisma.message.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({ roomId: room.id, message: 'old' + i, playerId: a.player.id })),
    })
    await post('/message', a, { roomId: room.id, message: 'new' })
    expect(await prisma.message.count({ where: { roomId: room.id } })).toBe(200)
    expect(await prisma.message.findFirst({ where: { message: 'old0' } })).toBeNull()
  })

  test('GET returns the room’s messages (public), 404 / 400 otherwise', async () => {
    const { room, a } = await startedRoom()
    await post('/message', a, { roomId: room.id, message: 'one' })
    await post('/message', a, { roomId: room.id, message: 'two' })
    const res = await request(app).get('/api/rooms/message?roomId=' + room.id)
    expect(res.body.map((m: ChatMessage) => m.message)).toEqual(['one', 'two'])
    expect((await request(app).get('/api/rooms/message?roomId=999999')).status).toBe(404)
    expect((await request(app).get('/api/rooms/message')).status).toBe(400)
  })
})

describe('app-level behaviour', () => {
  test('malformed JSON is a 400 with a JSON body and no stack trace', async () => {
    const res = await request(app).post('/api/rooms/join').set('Authorization', session().auth)
      .set('Content-Type', 'application/json').send('{"roomId":')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: expect.any(String) })
    expect(res.text).not.toMatch(/at .*\.[jt]s/)
  })

  test('unknown API routes are a JSON 404', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not found' })
  })

  test('security headers are set and x-powered-by is not', async () => {
    const res = await request(app).get('/api')
    expect(res.body).toEqual({ ping: 'pong' })
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  test('room creation is rate limited per IP', async () => {
    const original = process.env.RATE_LIMIT_ROOMS_PER_MIN
    process.env.RATE_LIMIT_ROOMS_PER_MIN = '1'
    let limited!: Express
    jest.isolateModules(() => { limited = require('../app.ts').app })
    process.env.RATE_LIMIT_ROOMS_PER_MIN = original
    limited.set('socketio', io)

    const s = session()
    expect((await request(limited).post('/api/rooms').set('Authorization', s.auth)).status).toBe(200)
    const res = await request(limited).post('/api/rooms').set('Authorization', s.auth)
    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: 'too many requests' })
  })
})
