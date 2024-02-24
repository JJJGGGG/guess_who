 
var express = require('express');
var router = express.Router();
var {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

/* GET home page. */
router.get('/', async function(req, res, next) {
  return res.json(await prisma.room.findMany({include: { boards: true }}))
});

async function updateRooms(req) {
  const rooms = await prisma.room.findMany({include: { boards: true }});

  const io = req.app.get("socketio")

  io.emit("updateRooms", rooms)
}

router.post('/', async function(req, res, next) {
  const room = await prisma.room.create({
    data: {},
  })
  await updateRooms(req)
  return res.json(room)
});

router.post('/join', async function(req, res, next) {
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

  if(room.boards.length >= 2) {
    return res.sendStatus(400)
  }

  const board = await prisma.board.create({
    data: {
      roomId,
      playerId
    },
  })
  await updateRooms(req)
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
  await updateRooms(req)
  return res.json(bb)
})

router.post('/start', async function(req, res, next) {
  return res.json({nice: true})
})

module.exports = router;
