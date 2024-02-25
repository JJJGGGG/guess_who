import { Link, useParams } from "react-router-dom";
import useRoom from "./hooks/useRoom";

function Spectate() {

    const {roomId} = useParams();

    const [room] = useRoom(roomId)

    if(!(room?.boards.length == 2) || !room.boards[0].tiles.length || !room.boards[1].tiles.length) {
        return <div>
            Waiting for players to join...
        </div>
    }

    return <div >
        <Link to=""></Link>
    {
        room?.boards.map((board) => 
            <div>
                <div>{board.playerId}</div>
                
            <div className="grid grid-cols-3 gap-4">
                {board?.tiles.map((tile) => <div>
                    {!tile.flipped ? <div className={`bg-blue-500 rounded`}>
                        <img src={`/${tile.row}_${tile.col}.webp`}/>

                    </div> : ""}
                    {tile.flipped ? <div className={`bg-red-500 rounded`} style={{height: "78px"}}></div> : ""}
                </div>)}
                <img src={`/${board.chosenRow}_${board.chosenCol}.webp`}/>
            </div>
            </div>
        )
    }
    </div>
}

export default Spectate;