export type Room = {
    id: number,
    boards: Board[]
}

export type Board = {
    id: number,
    playerId: string,
    tiles: Tile[]
    chosenRow?: number,
    chosenCol?: number
}

export type Tile = {
    id: number,
    row: number,
    col: number,
    name: string,
    photoUrl: string,
    flipped: boolean
}