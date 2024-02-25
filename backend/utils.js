
var {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

async function updateRooms(io) {
    const rooms = await prisma.room.findMany({include: { boards: { include: { tiles: true } } }});
  
    io.emit("updateRooms", rooms)
  }

  module.exports = {
    updateRooms
  }