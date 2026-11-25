import { useEffect, useState } from "react";
import { Board } from "../types";
import { socket } from "../socket";
import { apiFetch } from "../api";
import usePlayer from "./usePlayer";

function useBoard(roomId?: string): [Board | undefined, (row: number, col: number) => void] {
    const { player } = usePlayer()
    const playerId = player?.id
    const [board, setBoard] = useState<Board>()
    useEffect(() => {
        if(playerId && roomId) {

            apiFetch("/rooms")
                .then((res) => res.json())
                .then((res) => res.find((r: any) => r.id == roomId))
                .then((res) => res?.boards.find((r: any) => r.playerId == playerId))
                .then((res) => setBoard(res))
        }
    }, [playerId, roomId])

    useEffect(() => {
        function updateRooms(rooms: any) {
            const board = rooms.find((r: any) => r.id == roomId)?.boards.find((r: any) => r.playerId == playerId)
            setBoard(board)
        }
        socket.on("updateRooms", updateRooms)

        return () => {
            socket.off("updateRooms", updateRooms)
        }
    }, [playerId, roomId])
    function switchTile(row: number, col: number) {
         apiFetch("/rooms/tiles/flip", {
            method: "POST",
            body: JSON.stringify({
                roomId: parseInt(roomId || ""),
                row,
                col
            })
         })
    }
    return [board, switchTile]
}

export default useBoard;
