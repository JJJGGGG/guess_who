// Shapes sent between server and client (HTTP JSON bodies and socket.io
// events). Types only: no runtime code, so Vite and Node both just erase it.
// Dates are ISO strings here because that is what arrives over the wire.

export type Player = {
    id: string,
    name: string
}

// A room as anyone watching it sees it: GET /api/rooms/:id and "updateRoom".
// Never includes chosen characters.
export type Room = {
    id: number,
    boards: PublicBoard[]
}

export type PublicBoard = {
    id: number,
    playerId: string,
    playerName: string,
    disconnectedAt: string | null,
    ready: boolean,
    tiles: PublicTile[]
}

export type PublicTile = Pick<Tile, "row" | "col" | "flipped">

// Lobby list entry: GET /api/rooms and the "updateRooms" event.
export type RoomSummary = {
    id: number,
    boards: Pick<PublicBoard, "id" | "playerId" | "playerName">[]
}

// The logged-in player's own board: GET /api/rooms/:id/board and "board".
export type Board = {
    id: number,
    roomId: number,
    playerId: string,
    playerName: string,
    tiles: Tile[]
    chosenRow: number | null,
    chosenCol: number | null
}

export type Tile = {
    id: number,
    row: number,
    col: number,
    name: string,
    photoUrl: string,
    flipped: boolean
}

// A stored chat message: GET/POST /api/rooms/message (oldest first).
export type ChatMessage = {
    id: number,
    roomId: number,
    playerId: string,
    playerName: string,
    message: string
}

// One new chat message, pushed to the room channel as "updateChat".
export type ChatUpdate = {
    rid: number,
    newMessage: string,
    playerId: string,
    playerName: string
}

// POST /api/session and GET /api/session.
export type SessionInfo = {
    player: Player,
    graceSeconds: number
}

export type NewSession = SessionInfo & { token: string }

// POST /api/rooms/start.
export type StartResult = { started: boolean }

// Any JSON error body.
export type ApiError = { error: string }

// The page a tab shows; see the "watch" event.
export type WatchTarget = "lobby" | number

export interface ServerToClientEvents {
    updateRooms: (rooms: RoomSummary[]) => void
    updateRoom: (room: Room | null) => void
    board: (board: Board) => void
    startGame: (roomId: number) => void
    updateChat: (update: ChatUpdate) => void
}

export interface ClientToServerEvents {
    watch: (target: WatchTarget) => void
}
