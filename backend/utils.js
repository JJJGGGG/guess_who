
var {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

require('dotenv').config()

const GRACE_SECONDS = parseInt(process.env.GRACE_SECONDS) || 30

async function updateRooms(io) {
    const rooms = await prisma.room.findMany({include: { boards: { include: { tiles: true } } }});

    io.emit("updateRooms", rooms)
  }
  async function updateChat(io, message) {

    io.emit("updateChat", message)
  }

  module.exports = {
    GRACE_SECONDS,
    updateRooms,
    updateChat
  }
