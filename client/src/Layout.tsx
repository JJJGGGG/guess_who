import { Outlet } from "react-router-dom";
import usePlayer from "./hooks/usePlayer";
import ConnectionBanner from "./ConnectionBanner";
import { useState } from "react";
import { string, ValidationError } from "yup";

const MAX_NAME_LENGTH = 20

const nameSchema = string()
    .trim()
    .required("Enter a name")
    .max(MAX_NAME_LENGTH, `Names can be at most ${MAX_NAME_LENGTH} characters`)

export default function Layout() {
    const { status, player, login } = usePlayer()
    const [error, setError] = useState("")

    async function chooseName(e: any) {
        e.preventDefault()
        let name: string
        try {
            name = await nameSchema.validate(e.target.playerName.value)
        } catch (err) {
            if (err instanceof ValidationError) {
                setError(err.message)
                return
            }
            throw err
        }
        setError("")
        if (!await login(name)) {
            setError("Couldn't start a session, try again")
        }
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
                    <input className="rounded border border-gray-500 mb-2" name="playerName" maxLength={MAX_NAME_LENGTH} required/>
                    {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
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
