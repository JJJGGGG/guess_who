import { Link, useParams, useSearchParams } from "react-router-dom";
import useRoom from "./hooks/useRoom";
import Chat from "./Chat";

function Spectate() {
    const [searchParams] = useSearchParams();

    const {roomId} = useParams();

    const [room] = useRoom(roomId)

    if(!(room?.boards.length == 2) || !room.boards[0].tiles.length || !room.boards[1].tiles.length) {
        return <div>
            <Link to={`/?playerId=${searchParams.get('playerId')}`} className="rounded text-white bg-red-600 px-2 py-1 mb-2">Exit</Link>
            <div>
                Waiting for players to join...
            </div>

            <Chat />
        </div>
    }

    return <div >
        <Link to={`/?playerId=${searchParams.get('playerId')}`} className="rounded text-white bg-red-600 px-2 py-1 mb-2">Exit</Link>
        {
            room?.boards.map((board) => 
                <div key={board.id}>
                    <div>{board.playerId}'s board</div>
                    
                <div className="grid grid-cols-6 gap-4">
                    {board?.tiles.map((tile) => <div key={tile.id}>
                        {!tile.flipped ? <div className={`bg-blue-500 rounded`}>
                            <img src={`/${tile.row}_${tile.col}.webp`}/>

                        </div> : ""}
                        {tile.flipped ? <div className={`bg-red-500 rounded`} style={{height: "78px"}}></div> : ""}
                    </div>)}
                    <div>
                        <div>Chosen character: </div>
                        <img src={`/${board.chosenRow}_${board.chosenCol}.webp`}/>
                    </div>
                </div>
                </div>
            )
        }
        <Chat />
    </div>
}

export default Spectate;