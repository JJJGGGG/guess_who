import 'dotenv/config'
import { Prisma, PrismaClient } from '@prisma/client'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ValidationError, string } from 'yup'
import type { AnyObject, AnyObjectSchema, ObjectSchema } from 'yup'
import type { Board, ChatMessage, ChatUpdate, Room, RoomSummary } from '../shared/types.ts'
import type { Broadcaster } from './types.ts'

const prisma = new PrismaClient()

export const GRACE_SECONDS = parseInt(process.env.GRACE_SECONDS ?? '') || 30
// Soft cap: also bounds what updateLobby re-reads and broadcasts.
export const MAX_OPEN_ROOMS = parseInt(process.env.MAX_OPEN_ROOMS ?? '') || 50
// Messages sent to clients per room; older ones stay stored up to the trim limit.
const RECENT_MESSAGES = 100

// socket.io channels. A socket watches either the lobby or one room (see the
// "watch" handler in routes/socket.ts), so events only reach the page that
// shows them.
export const LOBBY = "lobby"
export const roomChannel = (id: number): string => "room:" + id

// What the lobby needs: who is in each room, no boards or chosen characters.
// `satisfies` keeps the literal type, so Prisma infers the exact result shape
// and a mismatch with RoomSummary is a compile error in lobbyRooms below.
export const lobbySelect = {
  id: true,
  boards: { select: { id: true, playerId: true, playerName: true } }
} satisfies Prisma.RoomSelect

const roomInclude = { boards: { include: { tiles: true } } } satisfies Prisma.RoomInclude

type RoomWithTiles = Prisma.RoomGetPayload<{ include: typeof roomInclude }>
// Tiles are optional: a board loaded without them gets an empty list.
type BoardWithTiles = Prisma.BoardGetPayload<object> & { tiles?: Prisma.TileGetPayload<object>[] }

type Position = { row: number, col: number }
const byPosition = (a: Position, b: Position): number => a.row - b.row || a.col - b.col

// What anyone watching a room may see: players, connection state, whether a
// character was picked, and which tiles are flipped. Never the chosen
// character (identity is per tab, so spectators include the opponent).
function publicRoom(room: RoomWithTiles): Room {
  return {
    id: room.id,
    boards: room.boards.map(b => ({
      id: b.id,
      playerId: b.playerId,
      playerName: b.playerName,
      disconnectedAt: b.disconnectedAt?.toISOString() ?? null,
      ready: b.chosenRow != null,
      tiles: [...b.tiles].sort(byPosition).map(({ row, col, flipped }) => ({ row, col, flipped }))
    }))
  }
}

// A board as its owner sees it, chosen character included.
export function privateBoard(board: BoardWithTiles): Board {
  return {
    id: board.id,
    roomId: board.roomId,
    playerId: board.playerId,
    playerName: board.playerName,
    chosenRow: board.chosenRow,
    chosenCol: board.chosenCol,
    tiles: [...(board.tiles ?? [])].sort(byPosition)
  }
}

// The lobby list, as GET /api/rooms and the "updateRooms" event send it.
export async function lobbyRooms(): Promise<RoomSummary[]> {
  return prisma.room.findMany({ select: lobbySelect })
}

// After a player leaves (or is swept), the game in those rooms is over: drop
// every tile, clear chosen characters and let /start run again.
export async function resetGames(roomIds: number[]): Promise<void> {
  await prisma.$transaction([
    prisma.tile.deleteMany({ where: { board: { roomId: { in: roomIds } } } }),
    prisma.board.updateMany({
      where: { roomId: { in: roomIds } },
      data: { chosenRow: null, chosenCol: null }
    }),
    prisma.room.updateMany({
      where: { id: { in: roomIds } },
      data: { started: false }
    })
  ])
}

// Marks a game action in the room, which postpones its idle cleanup.
// updateMany: the room may have been deleted meanwhile, which is not an error.
export async function touchRoom(roomId: number): Promise<void> {
  await prisma.room.updateMany({ where: { id: roomId }, data: { lastActivityAt: new Date() } })
}

function prismaCode(e: unknown): unknown {
  return typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined
}
// Prisma's error for a unique constraint violation.
export const isUniqueViolation = (e: unknown): boolean => prismaCode(e) === 'P2002'
// Prisma's error for a missing related row (e.g. the room was deleted meanwhile).
export const isForeignKeyViolation = (e: unknown): boolean => prismaCode(e) === 'P2003'

// The newest RECENT_MESSAGES of a room, oldest first.
export async function recentMessages(roomId: number): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: { id: 'desc' },
    take: RECENT_MESSAGES
  })
  return messages.reverse()
}

export async function getPublicRoom(roomId: number): Promise<Room | null> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomInclude })
  return room && publicRoom(room)
}

export async function updateLobby(io: Broadcaster): Promise<void> {
  io.to(LOBBY).emit("updateRooms", await lobbyRooms())
}

// Public state to the room channel, and each player's own board to them only.
export async function updateRoom(io: Broadcaster, roomId: number): Promise<void> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomInclude })
  io.to(roomChannel(roomId)).emit("updateRoom", room && publicRoom(room))
  for(const board of room?.boards ?? []) {
    io.to("player:" + board.playerId).emit("board", privateBoard(board))
  }
}

// A string schema that trims. yup's own .trim() calls value.trim() before the
// type check, so an object or array (e.g. {"name": {}}) threw a TypeError and
// became a 500; this leaves non-strings alone so the type check answers 400.
export const trimmedString = () => string().transform((v: unknown) => typeof v === 'string' ? v.trim() : v)

type Source = 'body' | 'query' | 'params'

// Validates req[source] with a yup schema and replaces it with the cast value
// (trimmed strings, numbers from query strings, unknown keys dropped).
// Express 5 leaves req.body undefined when no parser ran, and makes req.query a
// getter, so default to {} and redefine the property instead of assigning it.
// Handlers after it read the value with `validated(req, schema, source)`.
export function validate(schema: AnyObjectSchema, source: Source = 'body'): RequestHandler {
  return function(req: Request, res: Response, next: NextFunction): void {
    schema.validate(req[source] ?? {}, { stripUnknown: true }).then(function(value) {
      Object.defineProperty(req, source, { value, writable: true, enumerable: true, configurable: true })
      next()
    }, function(err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message })
        return
      }
      next(err)
    })
  }
}

// The value validate(schema, source) left on req, typed from the schema.
// Only call it in a handler that runs after that validate().
export function validated<T extends AnyObject>(req: Request, _schema: ObjectSchema<T>, source: Source = 'body'): T {
  return req[source] as T
}

export function updateChat(io: Broadcaster, roomId: number, message: ChatUpdate): void {
  io.to(roomChannel(roomId)).emit("updateChat", message)
}

// The socket.io server index.ts stored on the app (tests store a fake).
export function ioOf(req: Request): Broadcaster {
  return req.app.get('socketio')
}
