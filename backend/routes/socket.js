const { Server } = require("socket.io");
const http = require('http');
require('dotenv').config()

function addWebsockets(server, app) {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST"]
            }
        });

    app.set('socketio', io)

    io.on('connection', (socket) => {
        console.log('a user connected');
      });

}

module.exports = addWebsockets;