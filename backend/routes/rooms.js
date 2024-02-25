 
var express = require('express');
var router = express.Router();
var {PrismaClient} = require('@prisma/client')
const { updateRooms } = require('../utils')

const prisma = new PrismaClient()

/* GET home page. */
router.get('/', async function(req, res, next) {
  return res.json(await prisma.room.findMany({include: { boards: { include: { tiles: true } } }}))
});

router.post('/', async function(req, res, next) {
  const room = await prisma.room.create({
    data: {},
  })
  await updateRooms(req.app.get("socketio"))
  return res.json(room)
});

router.post('/join', async function(req, res, next) {
  const roomId = req.body.roomId;
  const playerId = req.body.playerId;
  const socketId = req.body.socketId;

  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    },
    include: {
      boards: true
    }
  })

  if(room.boards.length >= 2) {
    return res.sendStatus(400)
  }

  const board = await prisma.board.create({
    data: {
      roomId,
      playerId,
      socketId
    },
  })
  await updateRooms(req.app.get("socketio"))
  return res.json(board)
})

router.post('/leave', async function(req, res, next) {
  const roomId = req.body.roomId;
  const playerId = req.body.playerId;

  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    },
    include: {
      boards: true
    }
  })

  if(room.boards.map(b => b.playerId == playerId).length == 0) {
    return res.sendStatus(400)
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
  await updateRooms(req.app.get("socketio"))
  return res.json(bb)
})

router.post('/start', async function(req, res, next) {
  const roomId = req.body.roomId;
  const playerId = req.body.playerId;

  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
    },
    include: {
      boards: {
        include: {
          tiles: true
        }
      }
    }
  })



  await Promise.all(room.boards.map(async (board) => {
    for(let i=0; i<3; i++) {
      for(let j=0; j<3; j++) {
        await prisma.tile.create({
          data: {
            boardId: board.id,
            flipped: false,
            photoUrl: "",
            name: "",
            row: i,
            col: j
          }
        })
      }
    }
  }))
  const io = req.app.get("socketio")

  io.emit("startGame", roomId)

  return res.json({started: true})
})

router.post("/tiles/flip", async function(req, res, next) {
  const playerId = req.body.playerId;
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

  const tile = board.tiles.find((tile) => tile.row == row && tile.col == col)

  const tileUpdate = await prisma.tile.update({
    where: {
      id: tile.id,
    },
    data: {
      flipped: !tile.flipped,
    },
  })

  updateRooms(req.app.get("socketio"))

  return res.json(tileUpdate)
})

router.post("/selectcharacter", async function(req, res, next) {
  const boardId = req.body.boardId;
  const col = req.body.col;
  const row = req.body.row;

  const board = await prisma.board.update({
    where: {
      id: boardId
    },
    data: {
      chosenCol: col,
      chosenRow: row
    }
  })

  updateRooms(req.app.get("socketio"))

  return res.json(board)
})

module.exports = router;
