
var express = require('express');
var router = express.Router();
var {PrismaClient} = require('@prisma/client')
const { updateLobby, updateRoom, updateChat, lobbySelect, getPublicRoom, privateBoard, resetGames, isUniqueViolation } = require('../utils')
const { requireAuth } = require('../auth')

const prisma = new PrismaClient()

// Lobby list: who is in each room, nothing else.
router.get('/', async function(req, res, next) {
  return res.json(await prisma.room.findMany({ select: lobbySelect }))
});

router.post('/', requireAuth, async function(req, res, next) {
  const room = await prisma.room.create({
    data: {},
  })
  await updateLobby(req.app.get("socketio"))
  return res.json(room)
});

router.post('/join', requireAuth, async function(req, res, next) {
  const roomId = req.body.roomId;
  const playerId = req.player.id;

  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    },
    include: {
      boards: true
    }
  })

  if(!room) {
    return res.sendStatus(404)
  }

  if(room.boards.length >= 2 || room.boards.some(b => b.playerId == playerId)) {
    return res.sendStatus(400)
  }

  // The check above can be stale by the time we insert. The unique
  // (roomId, slot) and (roomId, playerId) indexes make a concurrent second
  // insert fail, so a room never gets a third board or the same player twice.
  const taken = new Set(room.boards.map(b => b.slot))
  const slot = taken.has(0) ? 1 : 0

  let board
  try {
    board = await prisma.board.create({
      data: {
        roomId,
        playerId,
        playerName: req.player.name,
        slot
      },
    })
  } catch(e) {
    if(isUniqueViolation(e)) {
      return res.sendStatus(409)
    }
    throw e
  }
  const io = req.app.get("socketio")
  await updateLobby(io)
  await updateRoom(io, roomId)
  return res.json(board)
})

router.post('/leave', requireAuth, async function(req, res, next) {
  const roomId = req.body.roomId;
  const playerId = req.player.id;

  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    },
    include: {
      boards: true
    }
  })

  if(!room) {
    return res.sendStatus(404)
  }

  if(!room.boards.some(b => b.playerId == playerId)) {
    return res.sendStatus(403)
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
  const io = req.app.get("socketio")
  await updateLobby(io)
  await updateRoom(io, roomId)
  return res.json(bb)
})

router.post('/start', requireAuth, async function(req, res, next) {
  const roomId = req.body.roomId;
  const playerId = req.player.id;

  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
    },
    include: {
      boards: true
    }
  })

  if(!room || !room.boards.some(b => b.playerId == playerId)) {
    return res.sendStatus(403)
  }

  if(room.boards.length != 2) {
    return res.json({started: false})
  }

  // Only the request that flips started false -> true creates tiles, so two
  // parallel starts can't both run.
  const claimed = await prisma.room.updateMany({
    where: { id: roomId, started: false },
    data: { started: true }
  })
  if(!claimed.count) {
    return res.json({started: false})
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
  } catch(e) {
    // A board was deleted in between (leave or sweep). Undo the claim so the
    // room can be started again once it has two players.
    await prisma.room.update({ where: { id: roomId }, data: { started: false } }).catch(console.error)
    return res.sendStatus(409)
  }

  const io = req.app.get("socketio")

  io.to(room.boards.map(b => "player:" + b.playerId)).emit("startGame", roomId)

  updateRoom(io, roomId).catch(console.error)

  return res.json({started: true})
})

router.post("/tiles/flip", requireAuth, async function(req, res, next) {
  const playerId = req.player.id;
  const roomId = req.body.roomId;
  const row = req.body.row;
  const col = req.body.col;

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
    return res.sendStatus(403)
  }

  const tile = board.tiles.find((tile) => tile.row == row && tile.col == col)

  if(!tile) {
    return res.sendStatus(400)
  }

  const tileUpdate = await prisma.tile.update({
    where: {
      id: tile.id,
    },
    data: {
      flipped: !tile.flipped,
    },
  })

  updateRoom(req.app.get("socketio"), roomId).catch(console.error)

  return res.json(tileUpdate)
})

router.post("/selectcharacter", requireAuth, async function(req, res, next) {
  const playerId = req.player.id;
  const roomId = req.body.roomId;
  const col = req.body.col;
  const row = req.body.row;

  const owned = await prisma.board.findFirst({
    where: {
      roomId,
      playerId
    }
  })

  if(!owned) {
    return res.sendStatus(403)
  }

  const inRange = (n) => Number.isInteger(n) && n >= 0 && n <= 5
  if(!inRange(row) || !inRange(col)) {
    return res.sendStatus(400)
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
    return res.sendStatus(409)
  }

  const board = await prisma.board.findUnique({
    where: {
      id: owned.id
    }
  })

  updateRoom(req.app.get("socketio"), roomId).catch(console.error)

  return res.json(board)
})

router.get("/message", async function(req, res, next) {
  const roomId = parseInt(req.query.roomId);

  if(Number.isNaN(roomId)) {
    return res.sendStatus(400)
  }

  const room = await prisma.room.findFirst({
    where: { id: roomId },
    include: {
      messages: true
    }
  })

  if(!room) {
    return res.sendStatus(404)
  }

  return res.json(room.messages)
})

// One room's public state (no chosen characters), for players and spectators.
router.get('/:id(\\d+)', async function(req, res, next) {
  const room = await getPublicRoom(parseInt(req.params.id))
  if(!room) {
    return res.sendStatus(404)
  }
  return res.json(room)
})

// The logged-in player's own board in that room, chosen character included.
router.get('/:id(\\d+)/board', requireAuth, async function(req, res, next) {
  const board = await prisma.board.findFirst({
    where: { roomId: parseInt(req.params.id), playerId: req.player.id },
    include: { tiles: true }
  })
  if(!board) {
    return res.sendStatus(404)
  }
  return res.json(privateBoard(board))
})

router.post("/message", requireAuth, async function(req, res, next) {
  const playerId = req.player.id;
  const playerName = req.player.name;
  const roomId = req.body.roomId;
  const message = req.body.message;

  const owned = await prisma.board.findFirst({
    where: {
      roomId,
      playerId
    }
  })

  if(!owned) {
    return res.sendStatus(403)
  }

  const room = await prisma.room.update({
    where: { id: roomId },
    data: {
      messages: {
        create: {
          message: message,
          playerId: playerId,
          playerName: playerName,
        }
      }
     },
     include: {
      messages: true
     }
  })

  updateChat(req.app.get("socketio"), roomId, {rid: roomId, newMessage: message, playerId: playerId, playerName: playerName})

  return res.json(room.messages)
})

module.exports = router;
