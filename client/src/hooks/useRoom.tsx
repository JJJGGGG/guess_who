import {useState, useEffect} from "react"
import type { Room } from "../../../shared/types"
import { socket } from "../socket"
import useWatch from "./useWatch"

// undefined while loading; null once the room is known to be gone (never
// existed, or deleted by the cleanup job).
function useRoom(roomId: string | undefined): [Room | null | undefined, (r: Room) => void] {
    const [room, setRoom] = useState<Room | null>()

    useWatch(roomId ? Number(roomId) : undefined)

    useEffect(() => {
        if(!roomId) {
            return
        }
        fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
            .then((res) => res.ok ? res.json() : (res.status == 404 ? null : undefined))
            .then((res) => setRoom(res))
    }, [roomId])

    useEffect(() => {
        // null means the room was deleted. The channel is per room, but a
        // late event from the previously watched room can still arrive.
        function updateRoom(room: Room | null) {
            if(room && room.id.toString() != roomId) {
                return
            }
            setRoom(room)
        }
        socket.on("updateRoom", updateRoom)

        return () => {
            socket.off("updateRoom", updateRoom)
        }
    }, [roomId])

    return [room, setRoom]
}

export default useRoom;
