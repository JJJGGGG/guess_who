import { Link, createSearchParams, useNavigate, useSearchParams } from "react-router-dom";
import useRooms from "./hooks/useRooms";
import { socket } from "./socket";

function Rooms() {

    let [searchParams, setSearchParams] = useSearchParams();

    const navigate = useNavigate()

    function chooseName(e: any) {
        setSearchParams((searchParams) => ({...searchParams, playerId: e.target.playerId.value}));
    }
    const [rooms, setRooms] = useRooms();

    async function createRoom() {
        await fetch(import.meta.env.VITE_BACKEND_URL + "/rooms", {
            headers: {
                "Content-Type": "application/json"
            },
            method: "post"
        })

        //TODO: borrar cuando hayan websockets

        const rooms = await fetch(import.meta.env.VITE_BACKEND_URL + "/rooms").then(r => r.json())

        setRooms(rooms)
    }

    async function joinRoom(id: number) {
        await fetch(import.meta.env.VITE_BACKEND_URL + "/rooms/join", {
            headers: {
                "Content-Type": "application/json"
            },
            method: "post",
            body: JSON.stringify({
                playerId: searchParams.get("playerId"),
                roomId: id,
                socketId: socket.id
            })
        })
        navigate({
            pathname: `rooms/${id}`, 
            search: createSearchParams({
                playerId: searchParams.get("playerId") || ""
            }).toString()
        })
    }


    if(!searchParams.has("playerId")) {
        return <form onSubmit={chooseName}>
            <div>
                <label className="font-bold mb-2">Enter player name</label>
            </div>
            <div>
                <input className="rounded border border-gray-500 mb-2" name="playerId"/>
            </div>
            <div>
                <button className="rounded text-white bg-sky-600 px-2 py-1 mb-2" type="submit">Enter</button>
            </div>
        </form>
    }

    return <div>
        <div>
            <button onClick={createRoom} className="rounded text-white bg-sky-600 px-2 py-1 mb-2">Create room</button>
        </div>
        <div>
            {rooms.map((room) => (
                <div key={room.id} className="border-b border-gray-500">Room {room.id} ({room.boards.length}/2) {
                    !room.boards.map((b) => b.playerId).includes(searchParams.get("playerId") || "") && room.boards.length < 2 ?
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