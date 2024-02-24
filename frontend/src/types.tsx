export type Room = {
    id: number,
    boards: Board[]
}

export type Board = {
    id: number,
    playerId: string
}