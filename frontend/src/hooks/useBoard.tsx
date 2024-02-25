import { useEffect, useState } from "react";
import { Board } from "../types";
import { socket } from "../socket";

function useBoard(playerId?: string, roomId?: string): [Board | undefined, (row: number, col: number) => void] {
    const [board, setBoard] = useState<Board>()
    useEffect(() => {
        if(playerId && roomId) {

            fetch(import.meta.env.VITE_BACKEND_URL + "/rooms")
                .then((res) => res.json())
                .then((res) => res.find((r: any) => r.id == roomId))
                .then((res) => res.boards.find((r: any) => r.playerId == playerId))
                .then((res) => setBoard(res))
        }
    }, [playerId, roomId])

    useEffect(() => {
        function updateRooms(rooms: any) {
            const board = rooms.find((r: any) => r.id == roomId).boards.find((r: any) => r.playerId == playerId)
            setBoard(board)
        }
        socket.on("updateRooms", updateRooms)

        return () => {
            socket.off("updateRooms", updateRooms)
        }
    }, [])
    function switchTile(row: number, col: number) {
         fetch(import.meta.env.VITE_BACKEND_URL + "/rooms/tiles/flip", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                playerId,
                roomId: parseInt(roomId || ""),
                row,
                col
            })
         })
    }
    return [board, switchTile] 
}

export default useBoard;