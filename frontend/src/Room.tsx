import { useNavigate, useParams } from "react-router-dom";
import useRoom from "./hooks/useRoom";
import { useEffect } from "react";
import { socket } from "./socket";
import Chat from "./Chat";
import DisconnectBanner from "./DisconnectBanner";
import { apiFetch } from "./api";

function Room() {
    const {roomId} = useParams()
    const navigate = useNavigate()

    const [room] = useRoom(roomId)

    useEffect(() => {
        function goToGame(id: number) {
            if(id.toString() == roomId){
                navigate(`/rooms/${roomId}/game`)
            }
        }

        socket.on("startGame", goToGame)

        return () => {
            socket.off("startGame", goToGame)
        }
    }, [])

    async function leaveRoom() {
        await apiFetch("/rooms/leave", {
            method: "post",
            body: JSON.stringify({
                roomId: parseInt(roomId || "")
            })
        })
        navigate("/")
    }

    async function startGame() {
        await apiFetch("/rooms/start", {
            method: "post",
            body: JSON.stringify({
                roomId: parseInt(roomId || "")
            })
        })
    }

    return <div>
        <div className="font-bold mb-2">Room {roomId}</div>
        <DisconnectBanner room={room} />
        <div>
            {room?.boards.length == 2 ?
                <button className="rounded text-white bg-sky-600 px-2 py-1 mb-2" onClick={startGame}>Start Game</button> :
                ""
            }
            <button className="rounded text-white bg-red-600 px-2 py-1 mb-2 ml-2" onClick={leaveRoom}>Leave room</button>
        </div>
        <div className="font-bold">Players:</div>
        <div>{room?.boards.map((b) =>
            <div className="mt-1" key={b.id}>
                {b.playerName}
            </div>
        )}</div>
        <div>
            <Chat />
        </div>
    </div>
}

export default Room;
