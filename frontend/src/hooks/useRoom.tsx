import {useState, useEffect} from "react"
import { Room } from "../types"
import { socket } from "../socket"

function useRoom(roomId: string | undefined): [Room | undefined, (r: Room) => void] {
    const [room, setRoom] = useState<Room>()

    useEffect(() => {
        fetch(import.meta.env.VITE_BACKEND_URL + "/rooms")
            .then((res) => res.json())
            .then((res) => res.find((r: any) => r.id == roomId))
            .then((res) => setRoom(res))
    }, [roomId])

    useEffect(() => {
        function updateRooms(rooms: any) {
            const room = rooms.find((r: any) => r.id == roomId)
            setRoom(room)

        }
        socket.on("updateRooms", updateRooms)

        return () => {
            socket.off("updateRooms", updateRooms)
        }
    }, [roomId])

    return [room, setRoom]
}

export default useRoom;