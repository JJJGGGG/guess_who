import express from 'express';
import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client'
import type { Board as DbBoard, Prisma, Room as DbRoom, Tile as DbTile } from '@prisma/client'
import { object, number } from 'yup'
import { updateLobby, updateRoom, updateChat, lobbyRooms, getPublicRoom, privateBoard, resetGames, touchRoom, isUniqueViolation, isForeignKeyViolation, recentMessages, validate, validated, trimmedString, ioOf, MAX_OPEN_ROOMS } from '../utils.ts'
import { requireAuth, playerOf } from '../auth.ts'
import type { ApiError, Board, ChatMessage, Room, RoomSummary, StartResult } from '../../shared/types.ts'

const router = express.Router();
const prisma = new PrismaClient()

const BOARD_SIZE = 6
const MAX_MESSAGE_LENGTH = 500
// Stored per room; older messages are deleted when a new one is posted.
const MAX_MESSAGES_PER_ROOM = 200

const roomId = number().integer().positive().required()
const cell = number().integer().min(0).max(BOARD_SIZE - 1).required()

const roomActionSchema = object({ roomId })
const tileSchema = object({ roomId, row: cell, col: cell })
const messageSchema = object({
  roomId,
  message: trimmedString().min(1).max(MAX_MESSAGE_LENGTH).required()
})
const messageQuerySchema = object({ roomId })
const idParamSchema = object({ id: roomId })

// Lobby list: who is in each room, nothing else.
router.get('/', async function(req: Request, res: Response<RoomSummary[]>) {
  res.json(await lobbyRooms())
});

router.post('/', requireAuth, async function(req: Request, res: Response<DbRoom | ApiError>) {
  if(await prisma.room.count() >= MAX_OPEN_ROOMS) {
    res.status(503).json({ error: 'too many rooms' })
    return
  }
  const room = await prisma.room.create({
    data: {},
  })
  await updateLobby(ioOf(req))
  res.json(room)
});

router.post('/join', requireAuth, validate(roomActionSchema), async function(req: Request, res: Response<DbBoard>) {
  const { roomId } = validated(req, roomActionSchema)
  const player = playerOf(req)
  const playerId = player.id

  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    },
    include: {
      boards: true
    }
  })

  if(!room) {
    res.sendStatus(404)
    return
  }

  if(room.boards.length >= 2 || room.boards.some(b => b.playerId == playerId)) {
    res.sendStatus(400)
    return
  }

  // The check above can be stale by the time we insert. The unique
  // (roomId, slot) and (roomId, playerId) indexes make a concurrent second
  // insert fail, so a room never gets a third board or the same player twice.
  const taken = new Set(room.boards.map(b => b.slot))
  const slot = taken.has(0) ? 1 : 0

  let board: DbBoard
  try {
    board = await prisma.board.create({
      data: {
        roomId,
        playerId,
        playerName: player.name,
        slot
      },
    })
  } catch(e) {
    if(isUniqueViolation(e)) {
      res.sendStatus(409)
      return
    }
    // The room was deleted (cleanup) between the lookup and the insert.
    if(isForeignKeyViolation(e)) {
      res.sendStatus(404)
      return
    }
    throw e
  }
  await touchRoom(roomId)
  const io = ioOf(req)
  await updateLobby(io)
  await updateRoom(io, roomId)
  res.json(board)
});

router.post('/leave', requireAuth, validate(roomActionSchema), async function(req: Request, res: Response<Prisma.BatchPayload>) {
  const { roomId } = validated(req, roomActionSchema)
  const playerId = playerOf(req).id

  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    },
    include: {
      boards: true
    }
  })

  if(!room) {
    res.sendStatus(404)
    return
  }

  if(!room.boards.some(b => b.playerId == playerId)) {
    res.sendStatus(403)
    return
  }

  const boards = await prisma.board.findMany({
    where: {
      roomId,
      playerId
    }
  })

  const bb = await prisma.board.deleteMany({
    where: {
      id: {
        in: boards.map(b => b.id)
      },
    },
  })
  // The game can't go on with one player; let the room start a new one.
  await resetGames([roomId])
  await touchRoom(roomId)
  const io = ioOf(req)
  await updateLobby(io)
  await updateRoom(io, roomId)
  res.json(bb)
});

router.post('/start', requireAuth, validate(roomActionSchema), async function(req: Request, res: Response<StartResult>) {
  const { roomId } = validated(req, roomActionSchema)
  const playerId = playerOf(req).id

  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
    },
    include: {
      boards: true
    }
  })

  if(!room || !room.boards.some(b => b.playerId == playerId)) {
    res.sendStatus(403)
    return
  }

  if(room.boards.length != 2) {
    res.json({started: false})
    return
  }

  // Only the request that flips started false -> true creates tiles, so two
  // parallel starts can't both run.
  const claimed = await prisma.room.updateMany({
    where: { id: roomId, started: false },
    data: { started: true }
  })
  if(!claimed.count) {
    res.json({started: false})
    return
  }

  const positions = Array.from({length: 36}, (e, i) => ({ row: Math.floor(i / 6), col: i % 6 }))
  try {
    await prisma.$transaction(room.boards.map(board => prisma.tile.createMany({
      data: positions.map(({ row, col }) => ({
        boardId: board.id,
        flipped: false,
        photoUrl: "",
        name: "",
        row,
        col
      }))
    })))
  } catch {
    // A board was deleted in between (leave or sweep). Undo the claim so the
    // room can be started again once it has two players.
    await prisma.room.update({ where: { id: roomId }, data: { started: false } }).catch(console.error)
    res.sendStatus(409)
    return
  }

  await touchRoom(roomId)
  const io = ioOf(req)

  io.to(room.boards.map(b => "player:" + b.playerId)).emit("startGame", roomId)

  updateRoom(io, roomId).catch(console.error)

  res.json({started: true})
});

router.post("/tiles/flip", requireAuth, validate(tileSchema), async function(req: Request, res: Response<DbTile>) {
  const playerId = playerOf(req).id
  const { roomId, row, col } = validated(req, tileSchema)

  const board = await prisma.board.findFirst({
    where: {
      roomId,
      playerId
    },
    include: {
      tiles: true
    }
  })

  if(!board) {
    res.sendStatus(403)
    return
  }

  const tile = board.tiles.find((tile) => tile.row == row && tile.col == col)

  if(!tile) {
    res.sendStatus(400)
    return
  }

  const tileUpdate = await prisma.tile.update({
    where: {
      id: tile.id,
    },
    data: {
      flipped: !tile.flipped,
    },
  })
  await touchRoom(roomId)

  updateRoom(ioOf(req), roomId).catch(console.error)

  res.json(tileUpdate)
});

router.post("/selectcharacter", requireAuth, validate(tileSchema), async function(req: Request, res: Response<DbBoard | null>) {
  const playerId = playerOf(req).id
  const { roomId, row, col } = validated(req, tileSchema)

  const owned = await prisma.board.findFirst({
    where: {
      roomId,
      playerId
    }
  })

  if(!owned) {
    res.sendStatus(403)
    return
  }

  // Conditional update so two concurrent requests can't both set a character.
  const updated = await prisma.board.updateMany({
    where: {
      id: owned.id,
      chosenRow: null
    },
    data: {
      chosenCol: col,
      chosenRow: row
    }
  })

  if(!updated.count) {
    res.sendStatus(409)
    return
  }

  await touchRoom(roomId)
  const board = await prisma.board.findUnique({
    where: {
      id: owned.id
    }
  })

  updateRoom(ioOf(req), roomId).catch(console.error)

  res.json(board)
});

router.get("/message", validate(messageQuerySchema, 'query'), async function(req: Request, res: Response<ChatMessage[]>) {
  const { roomId } = validated(req, messageQuerySchema, 'query')

  const room = await prisma.room.findUnique({ where: { id: roomId } })

  if(!room) {
    res.sendStatus(404)
    return
  }

  res.json(await recentMessages(roomId))
});

// One room's public state (no chosen characters), for players and spectators.
router.get('/:id', validate(idParamSchema, 'params'), async function(req: Request, res: Response<Room>) {
  const { id } = validated(req, idParamSchema, 'params')
  const room = await getPublicRoom(id)
  if(!room) {
    res.sendStatus(404)
    return
  }
  res.json(room)
});

// The logged-in player's own board in that room, chosen character included.
router.get('/:id/board', requireAuth, validate(idParamSchema, 'params'), async function(req: Request, res: Response<Board>) {
  const { id } = validated(req, idParamSchema, 'params')
  const board = await prisma.board.findFirst({
    where: { roomId: id, playerId: playerOf(req).id },
    include: { tiles: true }
  })
  if(!board) {
    res.sendStatus(404)
    return
  }
  res.json(privateBoard(board))
});

router.post("/message", requireAuth, validate(messageSchema), async function(req: Request, res: Response<ChatMessage[]>) {
  const { id: playerId, name: playerName } = playerOf(req)
  const { roomId, message } = validated(req, messageSchema)

  const owned = await prisma.board.findFirst({
    where: {
      roomId,
      playerId
    }
  })

  if(!owned) {
    res.sendStatus(403)
    return
  }

  await prisma.message.create({
    data: { roomId, message, playerId, playerName }
  })
  await touchRoom(roomId)

  // Keep only the newest MAX_MESSAGES_PER_ROOM.
  const [oldest] = await prisma.message.findMany({
    where: { roomId },
    orderBy: { id: 'desc' },
    skip: MAX_MESSAGES_PER_ROOM,
    take: 1,
    select: { id: true }
  })
  if(oldest) {
    await prisma.message.deleteMany({ where: { roomId, id: { lte: oldest.id } } })
  }

  updateChat(ioOf(req), roomId, {rid: roomId, newMessage: message, playerId: playerId, playerName: playerName})

  res.json(await recentMessages(roomId))
});

export default router;
