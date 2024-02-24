import {useState, useEffect} from "react"
import { Room } from "../types"
import { socket } from "../socket"

function useRooms(): [Room[], (r: Room[]) => void] {
    const [rooms, setRooms] = useState<Room[]>([])

    useEffect(() => {
        fetch(import.meta.env.VITE_BACKEND_URL + "/rooms")
            .then((res) => res.json())
            .then((res) => setRooms(res))
    }, [])

    useEffect(() => {
        function updateRooms(rooms: any) {
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