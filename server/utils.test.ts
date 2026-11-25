import { prisma, resetDb, session, createRoom, startedRoom } from '../test/helpers.ts'
import { getPublicRoom, privateBoard, resetGames, recentMessages, validate } from './utils.ts'
import { object, number, string } from 'yup'
import type { NextFunction, Request, Response } from 'express'

type Board = Parameters<typeof privateBoard>[0]

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

describe('getPublicRoom', () => {
  test('null for an unknown room', async () => {
    expect(await getPublicRoom(999999)).toBeNull()
  })

  test('hides chosen characters and tile details, sorts tiles', async () => {
    const { room, a } = await startedRoom()
    await prisma.board.updateMany({ where: { playerId: a.player.id }, data: { chosenRow: 2, chosenCol: 3 } })

    const pub = (await getPublicRoom(room.id))!
    const json = JSON.stringify(pub)
    expect(json).not.toMatch(/chosen/)
    expect(json).not.toMatch(/photoUrl|"name"/)

    const boardA = pub.boards.find(b => b.playerId === a.player.id)!
    const boardB = pub.boards.find(b => b.playerId !== a.player.id)!
    expect(boardA.ready).toBe(true)
    expect(boardB.ready).toBe(false)
    expect(boardA.tiles).toHaveLength(36)
    expect(Object.keys(boardA.tiles[0]).sort()).toEqual(['col', 'flipped', 'row'])
    const order = boardA.tiles.map(t => t.row * 6 + t.col)
    expect(order).toEqual([...order].sort((x, y) => x - y))
  })
})

describe('privateBoard', () => {
  test('keeps the chosen character and sorts tiles', () => {
    const board = {
      id: 1, roomId: 2, playerId: 'p', playerName: 'P', chosenRow: 1, chosenCol: 4, slot: 0, disconnectedAt: null,
      tiles: [{ row: 1, col: 0 }, { row: 0, col: 5 }, { row: 0, col: 1 }],
    }
    // Partial tiles on purpose: privateBoard only sorts, it doesn't read them.
    const out = privateBoard(board as unknown as Board)
    expect(out).toMatchObject({ chosenRow: 1, chosenCol: 4 })
    expect(out.tiles).toEqual([{ row: 0, col: 1 }, { row: 0, col: 5 }, { row: 1, col: 0 }])
    expect(out).not.toHaveProperty('slot')
    expect(board.tiles[0]).toEqual({ row: 1, col: 0 }) // input not mutated
  })

  test('handles a board without tiles', () => {
    expect(privateBoard({ id: 1 } as Board).tiles).toEqual([])
  })
})

describe('resetGames', () => {
  test('clears tiles, choices and started only in the given rooms', async () => {
    const one = await startedRoom()
    const two = await startedRoom()
    await prisma.board.updateMany({ data: { chosenRow: 0, chosenCol: 0 } })

    await resetGames([one.room.id])

    const boards = await prisma.board.findMany({ include: { tiles: true, room: true } })
    for (const b of boards) {
      if (b.roomId === one.room.id) {
        expect(b).toMatchObject({ chosenRow: null, chosenCol: null, tiles: [], room: { started: false } })
      } else {
        expect(b).toMatchObject({ chosenRow: 0, chosenCol: 0, room: { started: true } })
        expect(b.tiles).toHaveLength(36)
      }
    }
    expect(two.room.id).not.toBe(one.room.id)
  })
})

describe('recentMessages', () => {
  test('returns the newest 100, oldest first', async () => {
    const s = session()
    const room = await createRoom([s])
    for (let i = 0; i < 105; i++) {
      await prisma.message.create({ data: { roomId: room.id, message: 'm' + i, playerId: s.player.id } })
    }
    const msgs = await recentMessages(room.id)
    expect(msgs).toHaveLength(100)
    expect(msgs[0].message).toBe('m5')
    expect(msgs[99].message).toBe('m104')
  })
})

describe('validate', () => {
  const schema = object({ id: number().integer().positive().required(), name: string().trim() })

  async function run(source: 'body' | 'query', input: unknown) {
    const req = {} as Request
    // Express 5 defines req.query as a getter; mimic that.
    Object.defineProperty(req, source, { get: () => input, configurable: true })
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()
    await new Promise((resolve) => {
      res.json.mockImplementation(resolve)
      next.mockImplementation(resolve)
      validate(schema, source)(req, res as unknown as Response, next as NextFunction)
    })
    return { req, res, next }
  }

  test('casts, trims and strips unknown keys', async () => {
    const { req, next } = await run('query', { id: '7', name: ' a ', extra: 1 })
    expect(next).toHaveBeenCalledWith()
    expect(req.query).toEqual({ id: 7, name: 'a' })
  })

  test('answers 400 with a message for invalid input', async () => {
    const { res, next } = await run('body', { id: 'abc' })
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('id') })
  })

  test('treats a missing body as {}', async () => {
    const { res } = await run('body', undefined)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
