import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, Player, ServerToClientEvents } from '../shared/types.ts'

// What socketAuth stores on each socket.
export type SocketData = { player: Player }

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

// What the utils.ts broadcasters need from the io server: only `to().emit()`.
// The real GameServer fits, and so does the tests' fake recorder.
export type Broadcaster = {
  to(channels: string | string[]): {
    emit<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>): unknown
  }
}

declare global {
  // Express declares Request in a global namespace, so augmenting it needs one.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set by requireAuth. Read it with playerOf(req), which checks it.
      player?: Player
    }
  }
}
