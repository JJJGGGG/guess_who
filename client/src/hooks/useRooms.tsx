import {useState, useEffect} from "react"
import type { RoomSummary } from "../../../shared/types"
import { socket } from "../socket"
import useWatch from "./useWatch"

function useRooms(): [RoomSummary[], (r: RoomSummary[]) => void] {
    const [rooms, setRooms] = useState<RoomSummary[]>([])

    useWatch("lobby")

    useEffect(() => {
        fetch("/api/rooms")
            .then((res) => res.ok ? res.json() : [])
            .then((res) => setRooms(res))
            .catch(console.error)
    }, [])

    useEffect(() => {
        function updateRooms(rooms: RoomSummary[]) {
            setRooms(rooms)
        }
        socket.on("updateRooms", updateRooms)

        return () => {
            socket.off("updateRooms", updateRooms)
        }
    }, [])

    return [rooms, setRooms]
}

export default useRooms;
