import { useParams, useSearchParams, createSearchParams, useNavigate } from "react-router-dom";
import useTiles from "./hooks/useBoard";
import Chat from "./Chat";

function Game() {
    const [searchParams] = useSearchParams();
    const { roomId } = useParams()
    const navigate = useNavigate()

    const [board, switchTile] = useTiles(searchParams.get("playerId") ?? undefined, roomId)

    async function selectCharacter(row: number, col: number) {
        await fetch(import.meta.env.VITE_BACKEND_URL + "/rooms/selectcharacter", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                boardId: board?.id,
                row,
                col
            })
        })
    }

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

    if(board?.chosenCol == undefined || board.chosenRow == undefined) {
        return (
            <div>
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