import { createSearchParams, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useRoom from "./hooks/useRoom";
import { useEffect } from "react";
import { socket } from "./socket";

function Room() {
    const {roomId} = useParams()
    const navigate = useNavigate()
    
    let [searchParams] = useSearchParams();

    const [room] = useRoom(roomId)

    useEffect(() => {
        function goToGame(id: number) {
            if(id.toString() == roomId){
                navigate({
                    pathname: `/rooms/${roomId}/game`,     
                    search: createSearchParams({
                        playerId: searchParams.get("playerId") || ""
                    }).toString()
                })
            }
        }

        socket.on("startGame", goToGame)

        return () => {
            socket.off("startGame", goToGame)
        }
    }, [])

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
    }

    return <div>
        <div className="font-bold mb-2">Room {roomId}</div>
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
                {b.playerId}
            </div>
        )}</div>
    </div>
}

export default Room;