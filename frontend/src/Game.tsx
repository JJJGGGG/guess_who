import { useParams, useSearchParams, createSearchParams, useNavigate } from "react-router-dom";
import useTiles from "./hooks/useBoard";

function Game() {
    let [searchParams, setSearchParams] = useSearchParams();
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

    console.log(board)

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
        return <div className="grid grid-cols-6 gap-4">
            {board?.tiles.map((tile) => <div key={tile.id} className="bg-blue-500" onClick={() => selectCharacter(tile.row, tile.col)}>
                    <img src={`/${tile.row}_${tile.col}.webp`}/></div>)}
        </div>
    }


    return <div>
        <button onClick={leaveRoom}>Exit Game</button>
        <div className="grid grid-cols-6 gap-4">
            {board?.tiles.map((tile) => <div key={tile.id}>
                {!tile.flipped ? <div className={`bg-blue-500 rounded`} onClick={() => switchTile(tile.row, tile.col)}>
                    <img src={`/${tile.row}_${tile.col}.webp`}/>

                </div> : ""}
                {tile.flipped ? <div className={`bg-red-500 rounded`} style={{height: "78px"}} onClick={() => switchTile(tile.row, tile.col)}></div> : ""}
            </div>)}
            <img src={`/${board.chosenRow}_${board.chosenCol}.webp`}/>
        </div>
    </div>
}

export default Game;