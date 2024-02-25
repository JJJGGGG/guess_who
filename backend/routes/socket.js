const { Server } = require("socket.io");
const http = require('http');
var {PrismaClient} = require('@prisma/client')
const { updateRooms } = require( '../utils');
const prisma = new PrismaClient()

require('dotenv').config()

function addWebsockets(server, app) {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST"]
            }
        });

    app.set('socketio', io);

    io.sockets.on('connection', function (socket) {

        socket.on('disconnect', async () => {
            console.log('a user disconnected');
            const socketid = socket.id;
            const board = await prisma.board.findFirst({
                where: {
                    socketId: socketid
                }
            })
            console.log(socketid)
            await prisma.board.deleteMany({
                where: {
                    id: board.id
                }
            })
            updateRooms(io);
        })
    });

}

module.exports = addWebsockets;