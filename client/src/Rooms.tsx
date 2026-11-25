import { Link, useNavigate } from "react-router-dom";
import useRooms from "./hooks/useRooms";
import usePlayer from "./hooks/usePlayer";
import { apiFetch } from "./api";
import { useState } from "react";
import Button from "./ui/Button";
import { buttonClass } from "./ui/classes";
import PlayerBadge from "./ui/PlayerBadge";
import { EyeIcon } from "./ui/icons";

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

    return <div className="grid gap-6 w-full max-w-3xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 className="gw-display">Rooms</h1>
                <p className="text-ink-muted">Join an open seat or watch a game in progress.</p>
            </div>
            <div className="grid gap-1 justify-items-end">
                <Button variant="primary" onClick={createRoom}>Create room</Button>
                {error && <div className="gw-error" role="alert">{error}</div>}
            </div>
        </div>
        {rooms.length == 0 && <p className="gw-panel text-center text-ink-muted">No rooms yet. Create one to start a game.</p>}
        <ul className="grid gap-2">
            {rooms.map((room) => {
                const mine = room.boards.some((b) => b.playerId == player?.id)
                const full = room.boards.length >= 2
                return <li key={room.id} aria-label={`Room ${room.id}`}
                    className={`gw-room${full ? " is-full" : ""}${mine ? " is-mine" : ""}`}>
                    <span className="gw-room__id">#{room.id}</span>
                    <div className="gw-room__seats">
                        <PlayerBadge seat={1} name={room.boards[0]?.playerName} you={room.boards[0]?.playerId == player?.id} />
                        <PlayerBadge seat={2} name={room.boards[1]?.playerName} you={room.boards[1]?.playerId == player?.id} />
                    </div>
                    <div className="gw-room__actions">
                        {!mine && !full && <Button variant="primary" size="sm" onClick={() => joinRoom(room.id)}>Join</Button>}
                        {mine && <Link to={`/rooms/${room.id}`} className={buttonClass("secondary", "sm")}>Open</Link>}
                        <Link to={`/rooms/${room.id}/spectate`} className={buttonClass("ghost", "sm")}><EyeIcon />Spectate</Link>
                    </div>
                </li>
            })}
        </ul>
    </div>
}

export default Rooms;
