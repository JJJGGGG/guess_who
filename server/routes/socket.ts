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
// Rooms with no game action (join, leave, start, flip, pick, chat) for this
// long are deleted even with players in them, so abandoned rooms don't pile up.
const ROOM_IDLE_MINUTES = Number(process.env.ROOM_IDLE_MINUTES || 30)

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

// Deletes rooms nobody is in, and rooms idle longer than ROOM_IDLE_MINUTES
// (boards, tiles and messages go with them via onDelete: Cascade). Anyone
// still on the page gets updateRoom(null) and is sent back to the lobby.
export async function cleanupRooms(io: Broadcaster): Promise<void> {
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000)
    const where = {
        OR: [
            { boards: { none: {} }, createdAt: { lt: minutesAgo(EMPTY_ROOM_TTL_MINUTES) } },
            { lastActivityAt: { lt: minutesAgo(ROOM_IDLE_MINUTES) } }
        ]
    }
    const stale = await prisma.room.findMany({ where, select: { id: true } })
    if(!stale.length) {
        return
    }
    // where is re-checked so a room that saw activity in between is kept.
    const ids = stale.map(r => r.id)
    await prisma.room.deleteMany({ where: { ...where, id: { in: ids } } })
    const gone = new Set((await prisma.room.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(r => r.id))
    const deleted = ids.filter(id => !gone.has(id))
    if(!deleted.length) {
        return
    }
    for(const id of deleted) {
        io.to(roomChannel(id)).emit("updateRoom", null)
    }
    await updateLobby(io)
}

// A player is present in a room while one of their tabs watches it (Room and
// Game pages watch the room channel). Leaving the page (back button, another
// URL, reload onto the lobby) or closing the last tab starts the grace period;
// watching the room again within GRACE_SECONDS ends it. The conditional
// where clauses keep an existing timestamp and make concurrent calls harmless.
// Calls are chained per player so quick back/forward navigation can't apply
// an older snapshot after a newer one.
const presenceQueue = new Map<string, Promise<void>>()

export function syncPresence(io: GameServer, playerId: string, ignoreSocketId?: string): Promise<void> {
    const run = (presenceQueue.get(playerId) ?? Promise.resolve())
        .catch(() => {})
        .then(() => applyPresence(io, playerId, ignoreSocketId))
    presenceQueue.set(playerId, run)
    const forget = () => { if(presenceQueue.get(playerId) === run) presenceQueue.delete(playerId) }
    run.then(forget, forget)
    return run
}

async function applyPresence(io: GameServer, playerId: string, ignoreSocketId?: string): Promise<void> {
    const sockets = (await io.in("player:" + playerId).fetchSockets())
        .filter(s => s.id !== ignoreSocketId)
    const watched = new Set<number>()
    for(const s of sockets) {
        for(const r of s.rooms) {
            if(r.startsWith("room:")) {
                watched.add(Number(r.slice("room:".length)))
            }
        }
    }

    const boards = await prisma.board.findMany({
        where: { playerId },
        select: { roomId: true }
    })
    const roomIds = [...new Set(boards.map(b => b.roomId))]
    const here = roomIds.filter(id => watched.has(id))
    const away = roomIds.filter(id => !watched.has(id))

    const [restored, marked] = await Promise.all([
        prisma.board.updateMany({
            where: { playerId, roomId: { in: here }, disconnectedAt: { not: null } },
            data: { disconnectedAt: null }
        }),
        prisma.board.updateMany({
            where: { playerId, roomId: { in: away }, disconnectedAt: null },
            data: { disconnectedAt: new Date() }
        })
    ])
    if(restored.count || marked.count) {
        await Promise.all(roomIds.map(id => updateRoom(io, id)))
    }
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

    // No restore on connect: only watching the room (sent by the page on
    // every connect) brings a player back.
    io.sockets.on('connection', function (socket) {
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
            syncPresence(io, playerId).catch(console.error)
        })

        // socket.io has already removed this socket from its channels; it is
        // filtered out anyway in case fetchSockets still lists it.
        socket.on('disconnect', () => {
            syncPresence(io, playerId, socket.id).catch(console.error)
        })
    });

    return { io, ready, stop: () => timers.forEach(clearInterval) }
}
