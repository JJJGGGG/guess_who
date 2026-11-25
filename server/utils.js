
var {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

require('dotenv').config()

const GRACE_SECONDS = parseInt(process.env.GRACE_SECONDS) || 30

// socket.io channels. A socket watches either the lobby or one room (see the
// "watch" handler in routes/socket.js), so events only reach the page that
// shows them.
const LOBBY = "lobby"
const roomChannel = (id) => "room:" + id

// What the lobby needs: who is in each room, no boards or chosen characters.
const lobbySelect = {
  id: true,
  boards: { select: { id: true, playerId: true, playerName: true } }
}

const roomInclude = { boards: { include: { tiles: true } } }

const byPosition = (a, b) => a.row - b.row || a.col - b.col

// What anyone watching a room may see: players, connection state, whether a
// character was picked, and which tiles are flipped. Never the chosen
// character (identity is per tab, so spectators include the opponent).
function publicRoom(room) {
  return {
    id: room.id,
    boards: room.boards.map(b => ({
      id: b.id,
      playerId: b.playerId,
      playerName: b.playerName,
      disconnectedAt: b.disconnectedAt,
      ready: b.chosenRow != null,
      tiles: [...b.tiles].sort(byPosition).map(({ row, col, flipped }) => ({ row, col, flipped }))
    }))
  }
}

// A board as its owner sees it, chosen character included.
function privateBoard(board) {
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

// After a player leaves (or is swept), the game in those rooms is over: drop
// every tile, clear chosen characters and let /start run again.
async function resetGames(roomIds) {
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

// Prisma's error for a unique constraint violation.
const isUniqueViolation = (e) => e && e.code === 'P2002'

async function getPublicRoom(roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomInclude })
  return room && publicRoom(room)
}

async function updateLobby(io) {
  const rooms = await prisma.room.findMany({ select: lobbySelect })
  io.to(LOBBY).emit("updateRooms", rooms)
}

// Public state to the room channel, and each player's own board to them only.
async function updateRoom(io, roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomInclude })
  io.to(roomChannel(roomId)).emit("updateRoom", room && publicRoom(room))
  for(const board of room?.boards ?? []) {
    io.to("player:" + board.playerId).emit("board", privateBoard(board))
  }
}

function updateChat(io, roomId, message) {
  io.to(roomChannel(roomId)).emit("updateChat", message)
}

module.exports = {
  GRACE_SECONDS,
  LOBBY,
  roomChannel,
  lobbySelect,
  getPublicRoom,
  privateBoard,
  resetGames,
  isUniqueViolation,
  updateLobby,
  updateRoom,
  updateChat
}
