import { Outlet } from "react-router-dom";
import usePlayer from "./hooks/usePlayer";
import ConnectionBanner from "./ConnectionBanner";

export default function Layout() {
    const { status, player, login } = usePlayer()

    async function chooseName(e: any) {
        e.preventDefault()
        await login(e.target.playerName.value)
    }

    return <div>
        <div className="px-12 py-8">
            <div className="text-2xl font-bold mb-4">Guess Who</div>
            {status == "loading" && <div>Loading...</div>}
            {status == "anonymous" && <form onSubmit={chooseName}>
                <div>
                    <label className="font-bold mb-2">Enter player name</label>
                </div>
                <div>
                    <input className="rounded border border-gray-500 mb-2" name="playerName" maxLength={20} required/>
                </div>
                <div>
                    <button className="rounded text-white bg-sky-600 px-2 py-1 mb-2" type="submit">Enter</button>
                </div>
            </form>}
            {status == "ready" && <>
                <div>Player name: {player?.name}</div>
                <ConnectionBanner />
                <Outlet />
            </>}
        </div>
    </div>
}
