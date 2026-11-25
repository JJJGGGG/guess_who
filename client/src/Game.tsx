import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useTiles from "./hooks/useBoard";
import useRoom from "./hooks/useRoom";
import usePlayer from "./hooks/usePlayer";
import Chat from "./Chat";
import DisconnectBanner from "./DisconnectBanner";
import { apiFetch } from "./api";

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
        return <div>{leftName} left the game. Returning to the room...</div>
    }

    if(board?.chosenCol == undefined || board.chosenRow == undefined) {
        return (
            <div>
                <DisconnectBanner room={room} />
                <div className="text-xl">Select your character</div>
                <div className="grid grid-cols-6 gap-4">
            {board?.tiles.map((tile) => <div key={tile.id} className="bg-blue-500" onClick={() => selectCharacter(tile.row, tile.col)}>
                    <img src={`/${tile.row}_${tile.col}.webp`}/></div>)}
                </div>
                <Chat />
            </div>
        );
    }


    return <div>
        <DisconnectBanner room={room} />
        <button className="rounded text-white bg-red-600 px-2 py-1 mb-2 ml-2" onClick={leaveRoom}>Exit Game</button>
        <div className="grid grid-cols-6 gap-4">
            {board?.tiles.map((tile) => <div key={tile.id}>
                {!tile.flipped ? <div className={`bg-blue-500 rounded`} onClick={() => switchTile(tile.row, tile.col)}>
                    <img src={`/${tile.row}_${tile.col}.webp`}/>

                </div> : ""}
                {tile.flipped ? <div className={`bg-red-500 rounded`} style={{height: "78px"}} onClick={() => switchTile(tile.row, tile.col)}></div> : ""}
            </div>)}
            <div>
                Your Character:
                <img src={`/${board.chosenRow}_${board.chosenCol}.webp`}/>
            </div>
        </div>
        <div><Chat /></div>
    </div>
}

export default Game;
