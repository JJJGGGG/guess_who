import { createSearchParams, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useRoom from "./hooks/useRoom";

function Room() {
    const {roomId} = useParams()
    const navigate = useNavigate()
    
    let [searchParams, setSearchParams] = useSearchParams();

    const [room, setRoom] = useRoom(roomId)

    async function leaveRoom() {
        await fetch(import.meta.env.VITE_BACKEND_URL + "/rooms/leave", {
            headers: {
                "Content-Type": "application/json"
            },
            method: "post",
            body: JSON.stringify({
                playerId: searchParams.get("playerId"),
                roomId: parseInt(roomId || "")
            })
        })
        navigate({
            pathname: "/",     
            search: createSearchParams({
                playerId: searchParams.get("playerId") || ""
            }).toString()
        })
    }

    async function startGame() {
        await fetch(import.meta.env.VITE_BACKEND_URL + "/rooms/start", {
            headers: {
                "Content-Type": "application/json"
            },
            method: "post",
            body: JSON.stringify({
                playerId: searchParams.get("playerId"),
                roomId: parseInt(roomId || "")
            })
        })
        navigate({
            pathname: `/rooms/${roomId}/game`,     
            search: createSearchParams({
                playerId: searchParams.get("playerId") || ""
            }).toString()
        })
    }

    return <div>
        <div>Room {roomId}</div>
        <div><button onClick={leaveRoom}>Leave room</button></div>
        <div>{room?.boards.map((b) => <div>
            {b.playerId}
        </div>)}</div>
        <div>
            {room?.boards.length == 2 ? 
                <button onClick={startGame}>Start Game</button> :
                ""
            }
        </div>
    </div>
}

export default Room;