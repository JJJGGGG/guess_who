import 'dotenv/config'
import { Server } from "socket.io";
import type http from 'http';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client'
import { updateLobby, updateRoom, resetGames, roomChannel, LOBBY, GRACE_SECONDS } from '../utils.ts';
import { socketAuth } from '../auth.ts'
import type { Broadcaster, GameServer } from '../types.ts'

const prisma = new PrismaClient()

const SWEEP_INTERVAL_MS = 5000
const CLEANUP_INTERVAL_MS = 60 * 1000
// Empty rooms older than this are deleted. Long enough that a fresh room isn't
// removed before anyone joins it.
const EMPTY_ROOM_TTL_MINUTES = Number(process.env.EMPTY_ROOM_TTL_MINUTES || 10)

// Deletes boards whose player stayed disconnected longer than GRACE_SECONDS,
// then resets the opponent's board in those rooms so a new game can start.
// The where clause is re-checked on delete, so a player who reconnected in
// the meantime (disconnectedAt cleared) keeps their board.
export async function sweep(io: Broadcaster): Promise<void> {
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
    await resetGames(roomIds)
    await updateLobby(io)
    await Promise.all(roomIds.map(id => updateRoom(io, id)))
}

// Deletes rooms nobody is in (messages go with them via onDelete: Cascade).
// Abandoned rooms end up here once sweep removes their disconnected players.
export async function cleanupRooms(io: Broadcaster): Promise<void> {
    const deleted = await prisma.room.deleteMany({
        where: {
            boards: { none: {} },
            createdAt: { lt: new Date(Date.now() - EMPTY_ROOM_TTL_MINUTES * 60 * 1000) }
        }
    })
    if(deleted.count) {
        await updateLobby(io)
    }
}

// Rooms the player has a board in, so a (dis)connect is only sent to them.
async function updatePlayerRooms(io: Broadcaster, playerId: string): Promise<void> {
    const boards = await prisma.board.findMany({
        where: { playerId },
        select: { roomId: true }
    })
    const roomIds = [...new Set(boards.map(b => b.roomId))]
    await Promise.all(roomIds.map(id => updateRoom(io, id)))
}

export type Websockets = {
    io: GameServer,
    // Resolves once the startup grace period is applied.
    ready: Promise<unknown>,
    // Clears the background jobs (used by tests to shut down cleanly).
    stop: () => void
}

export default function addWebsockets(server: http.Server, app: Express): Websockets {
    // No `cors` option: the client is served from the same origin. Auth is a
    // token in the handshake, so a cross-site connection gets nothing.
    const io: GameServer = new Server(server, {
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
    const ready = prisma.board.updateMany({
        where: { disconnectedAt: null },
        data: { disconnectedAt: new Date() }
    }).catch(console.error)

    const timers = [
        setInterval(() => sweep(io).catch(console.error), SWEEP_INTERVAL_MS),
        setInterval(() => cleanupRooms(io).catch(console.error), CLEANUP_INTERVAL_MS)
    ]

    io.sockets.on('connection', async function (socket) {
        const playerId = socket.data.player.id;
        socket.join("player:" + playerId)

        // The page this tab shows: "lobby" or a roomId. Replaces the previous
        // one. Rooms are public (anyone can spectate), so no membership check.
        // The payload comes from the client, so it is checked, not trusted.
        socket.on('watch', (target: unknown) => {
            let channel: string
            if(target === LOBBY) {
                channel = LOBBY
            } else if(typeof target === 'number' && Number.isInteger(target) && target > 0) {
                channel = roomChannel(target)
            } else {
                return
            }
            for(const r of socket.rooms) {
                if(r !== channel && (r === LOBBY || r.startsWith("room:"))) {
                    socket.leave(r)
                }
            }
            socket.join(channel)
        })

        socket.on('disconnect', async () => {
          try {
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
                updatePlayerRooms(io, playerId).catch(console.error)
            }
          } catch(e) {
            console.error(e)
          }
        })

        try {
            const restored = await prisma.board.updateMany({
                where: { playerId, disconnectedAt: { not: null } },
                data: { disconnectedAt: null }
            })
            if(restored.count) {
                updatePlayerRooms(io, playerId).catch(console.error)
            }
        } catch(e) {
            console.error(e)
        }
    });

    return { io, ready, stop: () => timers.forEach(clearInterval) }
}
