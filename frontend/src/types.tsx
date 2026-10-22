export type Player = {
    id: string,
    name: string
}

export type Room = {
    id: number,
    boards: Board[]
}

export type Board = {
    id: number,
    playerId: string,
    playerName: string,
    tiles: Tile[]
    chosenRow?: number,
    chosenCol?: number,
    disconnectedAt?: string | null
}

export type Tile = {
    id: number,
    row: number,
    col: number,
    name: string,
    photoUrl: string,
    flipped: boolean
}
