import {useState, useEffect} from "react"
import { Room } from "../types"
import { socket } from "../socket"
import useWatch from "./useWatch"

function useRoom(roomId: string | undefined): [Room | undefined, (r: Room) => void] {
    const [room, setRoom] = useState<Room>()

    useWatch(roomId ? Number(roomId) : undefined)

    useEffect(() => {
        if(!roomId) {
            return
        }
        fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
            .then((res) => res.ok ? res.json() : undefined)
            .then((res) => setRoom(res))
    }, [roomId])

    useEffect(() => {
        // null means the room was deleted. The channel is per room, but a
        // late event from the previously watched room can still arrive.
        function updateRoom(room: Room | null) {
            if(room && room.id.toString() != roomId) {
                return
            }
            setRoom(room ?? undefined)
        }
        socket.on("updateRoom", updateRoom)

        return () => {
            socket.off("updateRoom", updateRoom)
        }
    }, [roomId])

    return [room, setRoom]
}

export default useRoom;
