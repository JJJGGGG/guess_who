import { useEffect, useState } from "react";
import { Board } from "../types";
import { apiFetch } from "../api";
import { socket } from "../socket";

// The logged-in player's own board. Only its owner gets it (on the
// "player:<id>" channel), so the opponent's character never reaches this tab.
function useBoard(roomId: string | undefined): [Board | undefined, (row: number, col: number) => void] {
    const [board, setBoard] = useState<Board>()

    useEffect(() => {
        setBoard(undefined)
        if(!roomId) {
            return
        }
        let cancelled = false
        // Also on every reconnect: "board" events sent while offline are lost.
        function fetchBoard() {
            apiFetch(`/rooms/${encodeURIComponent(roomId!)}/board`)
                .then((res) => res.ok ? res.json() : undefined)
                .then((b) => { if(!cancelled) setBoard(b) })
                .catch(console.error)
        }
        function onBoard(b: Board) {
            if(b.roomId.toString() == roomId) {
                setBoard(b)
            }
        }
        fetchBoard()
        socket.on("connect", fetchBoard)
        socket.on("board", onBoard)
        return () => {
            cancelled = true
            socket.off("connect", fetchBoard)
            socket.off("board", onBoard)
        }
    }, [roomId])

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
