import { Link, useNavigate } from "react-router-dom";
import useRooms from "./hooks/useRooms";
import usePlayer from "./hooks/usePlayer";
import { apiFetch } from "./api";
import { useState } from "react";

function Rooms() {

    const navigate = useNavigate()
    const { player } = usePlayer()

    const [rooms] = useRooms();
    const [error, setError] = useState("")

    async function createRoom() {
        // The new room arrives through the lobby's "updateRooms" event.
        const res = await apiFetch("/rooms", {
            method: "post"
        })
        if (res.status == 503) {
            setError("Too many rooms open, try again later")
        } else if (res.status == 429) {
            setError("Too many rooms created, wait a minute")
        } else {
            setError(res.ok ? "" : "Couldn't create the room")
        }
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
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
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
