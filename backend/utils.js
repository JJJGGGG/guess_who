
var {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

async function updateRooms(io) {
    const rooms = await prisma.room.findMany({include: { boards: { include: { tiles: true } } }});
  
    io.emit("updateRooms", rooms)
  }
  async function updateChat(io, message) {
  
    io.emit("updateChat", message)
  }

  module.exports = {
    updateRooms,
    updateChat
  }