import { PrismaClient } from '@prisma/client'
import type { Room as DbRoom } from '@prisma/client'
import { sign } from '../server/auth.ts'
import type { Player, ServerToClientEvents } from '../shared/types.ts'
import type { Broadcaster } from '../server/types.ts'

export const prisma = new PrismaClient()

export async function resetDb(): Promise<void> {
  await prisma.message.deleteMany()
  await prisma.tile.deleteMany()
  await prisma.board.deleteMany()
  await prisma.room.deleteMany()
}

export type Session = { player: Player, token: string, auth: string }

let nextId = 0
// A signed-in player: { player, token, auth } where auth is the header value.
export function session(name = 'player'): Session {
  const player = { id: `test-${process.pid}-${++nextId}`, name }
  const token = sign(player)
  return { player, token, auth: 'Bearer ' + token }
}

// Payloads are loosely typed so tests can poke at them without casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Emitted = { to: string[], event: keyof ServerToClientEvents, payload: any }

export type FakeIo = Broadcaster & {
  emitted: Emitted[],
  sentTo(channel: string, event?: keyof ServerToClientEvents): Emitted[]
}

// Records every io.to(channels).emit(event, payload) call as
// { to: [...channels], event, payload }.
export function fakeIo(): FakeIo {
  const emitted: Emitted[] = []
  return {
    emitted,
    to(channels) {
      const to = ([] as string[]).concat(channels)
      return { emit: (event, payload) => emitted.push({ to, event, payload }) }
    },
    sentTo(channel, event) {
      return emitted.filter(e => e.to.includes(channel) && (!event || e.event === event))
    },
  }
}

export async function createRoom(players: Session[] = [], { started = false } = {}): Promise<DbRoom> {
  const room = await prisma.room.create({ data: { started } })
  for (const [slot, s] of players.entries()) {
    await prisma.board.create({
      data: { roomId: room.id, playerId: s.player.id, playerName: s.player.name, slot },
    })
  }
  return room
}

// Two players in a started room, each with a full 6x6 board.
export async function startedRoom(): Promise<{ room: DbRoom, a: Session, b: Session }> {
  const a = session('alice')
  const b = session('bob')
  const room = await createRoom([a, b], { started: true })
  const boards = await prisma.board.findMany({ where: { roomId: room.id } })
  for (const board of boards) {
    await prisma.tile.createMany({
      data: Array.from({ length: 36 }, (_, i) => ({
        boardId: board.id, row: Math.floor(i / 6), col: i % 6, flipped: false, name: '', photoUrl: '',
      })),
    })
  }
  return { room, a, b }
}
