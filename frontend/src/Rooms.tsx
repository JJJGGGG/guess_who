import { createSearchParams, useNavigate, useSearchParams } from "react-router-dom";
import useRooms from "./hooks/useRooms";

function Rooms() {

    let [searchParams, setSearchParams] = useSearchParams();

    const navigate = useNavigate()

    function chooseName(e: any) {
        setSearchParams((searchParams) => ({...searchParams, playerId: e.target.playerId.value}))
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
                roomId: id
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
            <label>Enter player name</label>
            <input name="playerId"/>
            <button type="submit">Enter</button>
        </form>
    }

    return <div>
        <div>
            <button onClick={createRoom}>Create room</button>
        </div>
        <div>
            {rooms.map((room) => (
                <div key={room.id}>Room {room.id} ({room.boards.length}/2) {
                    !room.boards.map((b) => b.playerId).includes(searchParams.get("playerId") || "") && room.boards.length < 2 ?
                    <button onClick={() => joinRoom(room.id)}>Join</button> :
                    ""
                }</div>
            ))}
        </div>
    </div>
}

export default Rooms;