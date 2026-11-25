import { useNavigate, useParams } from "react-router-dom";
import useRoom from "./hooks/useRoom";
import usePlayer from "./hooks/usePlayer";
import { useEffect } from "react";
import { socket } from "./socket";
import Chat from "./Chat";
import DisconnectBanner from "./DisconnectBanner";
import { apiFetch } from "./api";
import Button from "./ui/Button";
import PlayerBadge from "./ui/PlayerBadge";
import { LogOutIcon } from "./ui/icons";

function Room() {
    const {roomId} = useParams()
    const navigate = useNavigate()
    const { player } = usePlayer()

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
    }, [roomId, navigate])

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

    // You first, in your seat colour; then the opponent.
    const me = room?.boards.find((b) => b.playerId == player?.id)
    const other = room?.boards.find((b) => b.playerId != player?.id)
    const ready = room?.boards.length == 2

    return <div className="grid gap-6 w-full max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="gw-display">Room <span className="gw-code">#{roomId}</span></h1>
            <div className="flex gap-2">
                <Button variant="danger" onClick={leaveRoom}><LogOutIcon />Leave room</Button>
                <Button variant="primary" onClick={startGame} disabled={!ready}>Start game</Button>
            </div>
        </div>
        <DisconnectBanner room={room} />
        <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] items-start">
            <section className="gw-panel">
                <h2 className="gw-label">Players</h2>
                <div className="grid gap-2 justify-items-start">
                    <PlayerBadge seat={1} name={me?.playerName} you />
                    <PlayerBadge seat={2} name={other?.playerName} />
                </div>
                {!ready && <p className="text-[13px] leading-[18px] text-ink-muted">Waiting for a second player. Share the room number <span className="gw-code">#{roomId}</span>.</p>}
            </section>
            <section className="gw-panel">
                <Chat />
            </section>
        </div>
    </div>
}

export default Room;
