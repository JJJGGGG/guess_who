import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useTiles from "./hooks/useBoard";
import useRoom from "./hooks/useRoom";
import usePlayer from "./hooks/usePlayer";
import Chat from "./Chat";
import DisconnectBanner from "./DisconnectBanner";
import { apiFetch } from "./api";
import Board from "./ui/Board";
import CharacterTile from "./ui/CharacterTile";
import SecretCard from "./ui/SecretCard";
import PlayerBadge from "./ui/PlayerBadge";
import Banner from "./ui/Banner";
import Button from "./ui/Button";
import { ClockIcon, LogOutIcon } from "./ui/icons";

function Game() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { player } = usePlayer()

    const [room] = useRoom(roomId)
    const [board, switchTile] = useTiles(roomId)

    // Name of the opponent once seen, so we can tell when their grace period
    // expired and their board was removed.
    const opponentName = useRef<string>()
    const [leftName, setLeftName] = useState<string>()

    useEffect(() => {
        if(!room) {
            return
        }
        // Our own grace period expired while we were away.
        if(!room.boards.some((b) => b.playerId == player?.id)) {
            navigate("/")
            return
        }
        const opponent = room.boards.find((b) => b.playerId != player?.id)
        if(opponent) {
            opponentName.current = opponent.playerName
        } else if(opponentName.current) {
            setLeftName(opponentName.current)
            const timeout = setTimeout(() => navigate(`/rooms/${roomId}`), 3000)
            return () => clearTimeout(timeout)
        }
    }, [room, player?.id, navigate, roomId])

    async function selectCharacter(row: number, col: number) {
        await apiFetch("/rooms/selectcharacter", {
            method: "POST",
            body: JSON.stringify({
                roomId: parseInt(roomId || ""),
                row,
                col
            })
        })
    }

    async function leaveRoom() {
        await apiFetch("/rooms/leave", {
            method: "post",
            body: JSON.stringify({
                roomId: parseInt(roomId || "")
            })
        })
        navigate("/")
    }

    if(leftName) {
        return <Banner variant="info" icon={<ClockIcon size={20} />}>
            {leftName} left the game. Back to the room…
        </Banner>
    }

    const picking = board?.chosenCol == undefined || board.chosenRow == undefined
    const opponent = room?.boards.find((b) => b.playerId != player?.id)
    const chosen = board?.tiles.find((t) => t.row == board.chosenRow && t.col == board.chosenCol)
    const standing = board?.tiles.filter((t) => !t.flipped).length ?? 0

    return <div className="grid gap-4">
        <DisconnectBanner room={room} />
        <div className="gw-game">
            <section className="grid gap-3 min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h1 className="gw-display">{picking ? "Pick your character" : "Your board"}</h1>
                    <p className="text-ink-muted">
                        {picking
                            ? "Your opponent will try to guess who you picked."
                            : <><span className="gw-code text-ink">{standing}</span> still standing</>}
                    </p>
                </div>
                {board && <Board label="Your board">
                    {board.tiles.map((tile) => picking
                        ? <CharacterTile key={tile.id} row={tile.row} col={tile.col} name={tile.name} mode="pick"
                            onClick={() => selectCharacter(tile.row, tile.col)} />
                        : <CharacterTile key={tile.id} row={tile.row} col={tile.col} name={tile.name} flipped={tile.flipped}
                            onClick={() => switchTile(tile.row, tile.col)} />
                    )}
                </Board>}
            </section>
            <aside className="gw-side">
                {!picking && <SecretCard row={board!.chosenRow!} col={board!.chosenCol!} name={chosen?.name} />}
                <section className="gw-panel">
                    <h2 className="gw-label">Players</h2>
                    <div className="grid gap-2 justify-items-start">
                        <PlayerBadge seat={1} name={player?.name} you
                            status={picking ? { kind: "choosing", text: "Choosing…" } : { kind: "ready", text: "Locked in" }} />
                        <PlayerBadge seat={2} name={opponent?.playerName}
                            status={opponent?.disconnectedAt ? { kind: "away", text: "Away" }
                                : opponent?.ready ? { kind: "ready", text: "Locked in" }
                                : { kind: "choosing", text: "Choosing…" }} />
                    </div>
                    <Button variant="danger" size="sm" className="justify-self-start" onClick={leaveRoom}>
                        <LogOutIcon />Leave game
                    </Button>
                </section>
                <section className="gw-panel">
                    <Chat />
                </section>
            </aside>
        </div>
    </div>
}

export default Game;
