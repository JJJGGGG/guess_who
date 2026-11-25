const { PrismaClient } = require('@prisma/client')
const { sign } = require('../server/auth')

const prisma = new PrismaClient()

async function resetDb() {
  await prisma.message.deleteMany()
  await prisma.tile.deleteMany()
  await prisma.board.deleteMany()
  await prisma.room.deleteMany()
}

let nextId = 0
// A signed-in player: { player, token, auth } where auth is the header value.
function session(name = 'player') {
  const player = { id: `test-${process.pid}-${++nextId}`, name }
  const token = sign(player)
  return { player, token, auth: 'Bearer ' + token }
}

// Records every io.to(channels).emit(event, payload) call as
// { to: [...channels], event, payload }.
function fakeIo() {
  const emitted = []
  return {
    emitted,
    to(channels) {
      const to = [].concat(channels)
      return { emit: (event, payload) => emitted.push({ to, event, payload }) }
    },
    sentTo(channel, event) {
      return emitted.filter(e => e.to.includes(channel) && (!event || e.event === event))
    },
  }
}

async function createRoom(players = [], { started = false } = {}) {
  const room = await prisma.room.create({ data: { started } })
  for (const [slot, s] of players.entries()) {
    await prisma.board.create({
      data: { roomId: room.id, playerId: s.player.id, playerName: s.player.name, slot },
    })
  }
  return room
}

// Two players in a started room, each with a full 6x6 board.
async function startedRoom() {
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

module.exports = { prisma, resetDb, session, fakeIo, createRoom, startedRoom }
