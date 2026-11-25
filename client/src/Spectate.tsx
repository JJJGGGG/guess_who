import { Link, Navigate, useParams } from "react-router-dom";
import useRoom from "./hooks/useRoom";
import usePlayer from "./hooks/usePlayer";
import Chat from "./Chat";
import DisconnectBanner from "./DisconnectBanner";
import Board from "./ui/Board";
import CharacterTile from "./ui/CharacterTile";
import PlayerBadge from "./ui/PlayerBadge";
import { buttonClass } from "./ui/classes";
import { LogOutIcon } from "./ui/icons";

function Spectate() {
    const {roomId} = useParams();
    const { player } = usePlayer()

    const [room] = useRoom(roomId)

    // Players belong on their own game page. The server never sends chosen
    // characters to the room channel, so this is only a convenience.
    if(room?.boards.some((b) => b.playerId == player?.id)) {
        return <Navigate to={`/rooms/${encodeURIComponent(roomId || "")}/game`} replace />
    }

    const started = room?.boards.length == 2 && room.boards[0].tiles.length > 0 && room.boards[1].tiles.length > 0

    return <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="gw-display">Watching room <span className="gw-code">#{roomId}</span></h1>
            <Link to="/" className={buttonClass("secondary")}><LogOutIcon />Back to rooms</Link>
        </div>
        {started && <DisconnectBanner room={room} />}
        {!started
            ? <p className="gw-panel text-center text-ink-muted">Waiting for players to join…</p>
            : <div className="grid gap-6 lg:grid-cols-2">
                {room.boards.map((board, i) => {
                    const seat = i == 0 ? 1 : 2
                    return <section key={board.id} className="grid gap-3 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg font-semibold">{board.playerName}'s board</h2>
                            <PlayerBadge seat={seat} name={board.playerName}
                                status={board.disconnectedAt ? { kind: "away", text: "Away" }
                                    : board.ready ? { kind: "ready", text: "Locked in" }
                                    : { kind: "choosing", text: "Choosing…" }} />
                        </div>
                        <Board label={`${board.playerName}'s board`}>
                            {board.tiles.map((tile) => <CharacterTile key={`${tile.row}_${tile.col}`} row={tile.row} col={tile.col}
                                flipped={tile.flipped} mode="static" opponent={seat == 2} />)}
                        </Board>
                    </section>
                })}
            </div>}
        <section className="gw-panel w-full max-w-xl">
            <Chat readOnly />
        </section>
    </div>
}

export default Spectate;
