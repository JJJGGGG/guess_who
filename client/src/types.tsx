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
    disconnectedAt?: string | null,
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
