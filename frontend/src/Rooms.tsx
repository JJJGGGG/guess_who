import { Link, useNavigate } from "react-router-dom";
import useRooms from "./hooks/useRooms";
import usePlayer from "./hooks/usePlayer";
import { apiFetch } from "./api";

function Rooms() {

    const navigate = useNavigate()
    const { player } = usePlayer()

    const [rooms, setRooms] = useRooms();

    async function createRoom() {
        await apiFetch("/rooms", {
            method: "post"
        })

        //TODO: borrar cuando hayan websockets

        const rooms = await apiFetch("/rooms").then(r => r.json())

        setRooms(rooms)
    }

    async function joinRoom(id: number) {
        const res = await apiFetch("/rooms/join", {
            method: "post",
            body: JSON.stringify({
                roomId: id
            })
        })
        if(res.ok) {
            navigate(`/rooms/${id}`)
        }
    }

    return <div>
        <div>
            <button onClick={createRoom} className="rounded text-white bg-sky-600 px-2 py-1 mb-2">Create room</button>
        </div>
        <div>
            {rooms.map((room) => (
                <div key={room.id} className="border-b border-gray-500">Room {room.id} ({room.boards.length}/2) {
                    !room.boards.map((b) => b.playerId).includes(player?.id || "") && room.boards.length < 2 ?
                    <button className="text-blue-500 hover:underline ml-2" onClick={() => joinRoom(room.id)}>Join</button> :
                    ""
                }
                <Link to={`/rooms/${room.id}/spectate`} className="text-blue-500 hover:underline ml-2">Spectate</Link>
                </div>
            ))}
        </div>
    </div>
}

export default Rooms;
