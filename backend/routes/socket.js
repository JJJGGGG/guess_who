const { Server } = require("socket.io");
const http = require('http');
var {PrismaClient} = require('@prisma/client')
const { updateRooms, GRACE_SECONDS } = require( '../utils');
const { socketAuth } = require('../auth')
const prisma = new PrismaClient()

require('dotenv').config()

const SWEEP_INTERVAL_MS = 5000

// Deletes boards whose player stayed disconnected longer than GRACE_SECONDS,
// then resets the opponent's board in those rooms so a new game can start.
// The where clause is re-checked on delete, so a player who reconnected in
// the meantime (disconnectedAt cleared) keeps their board.
async function sweep(io) {
    const where = {
        disconnectedAt: {
            lt: new Date(Date.now() - GRACE_SECONDS * 1000)
        }
    }
    const expired = await prisma.board.findMany({ where })
    if(!expired.length) {
        return
    }

    const deleted = await prisma.board.deleteMany({
        where: { ...where, id: { in: expired.map(b => b.id) } }
    })
    if(!deleted.count) {
        return
    }

    const roomIds = [...new Set(expired.map(b => b.roomId))]
    await prisma.tile.deleteMany({
        where: { board: { roomId: { in: roomIds } } }
    })
    await prisma.board.updateMany({
        where: { roomId: { in: roomIds } },
        data: { chosenRow: null, chosenCol: null }
    })
    updateRooms(io)
}

function addWebsockets(server, app) {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST"]
            },
        // A silently dropped connection (lost network, no TCP close) is only
        // noticed by the heartbeat: worst case pingInterval + pingTimeout.
        // The defaults (25s + 20s) left the opponent waiting ~45s before the
        // grace period even started; this caps it at ~15s.
        pingInterval: 10000,
        pingTimeout: 5000
        });

    app.set('socketio', io);

    io.use(socketAuth)

    // Every socket died with the previous process, so start everyone's grace
    // period now. Players who reconnect within GRACE_SECONDS keep their game.
    // With multiple instances this must become a lastSeenAt heartbeat instead.
    prisma.board.updateMany({
        where: { disconnectedAt: null },
        data: { disconnectedAt: new Date() }
    }).catch(console.error)

    setInterval(() => sweep(io).catch(console.error), SWEEP_INTERVAL_MS)

    io.sockets.on('connection', async function (socket) {
        const playerId = socket.data.player.id;
        socket.join("player:" + playerId)

        socket.on('disconnect', async () => {
            console.log('a user disconnected');
            const others = (await io.in("player:" + playerId).fetchSockets())
                .filter(s => s.id !== socket.id)
            if(others.length) {
                return
            }
            const marked = await prisma.board.updateMany({
                where: { playerId, disconnectedAt: null },
                data: { disconnectedAt: new Date() }
            })
            if(marked.count) {
                updateRooms(io);
            }
        })

        const restored = await prisma.board.updateMany({
            where: { playerId, disconnectedAt: { not: null } },
            data: { disconnectedAt: null }
        })
        if(restored.count) {
            updateRooms(io);
        }
    });

}

module.exports = addWebsockets;
