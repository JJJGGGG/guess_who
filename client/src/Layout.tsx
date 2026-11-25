import { Link, Outlet } from "react-router-dom";
import usePlayer from "./hooks/usePlayer";
import ConnectionBanner from "./ConnectionBanner";
import { FormEvent, useState } from "react";
import { string, ValidationError } from "yup";
import Button from "./ui/Button";
import PlayerBadge from "./ui/PlayerBadge";
import CharacterTile from "./ui/CharacterTile";

const MAX_NAME_LENGTH = 20

const nameSchema = string()
    .trim()
    .required("Enter a name")
    .max(MAX_NAME_LENGTH, `Names can be at most ${MAX_NAME_LENGTH} characters`)

// A few tiles fanned out above the welcome form; two are flipped down.
const FAN: [number, number, boolean][] = [[0, 2, false], [1, 3, true], [0, 3, false], [2, 1, true], [1, 0, false]]

export default function Layout() {
    const { status, player, login } = usePlayer()
    const [error, setError] = useState("")

    async function chooseName(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        let name: string
        try {
            name = await nameSchema.validate(new FormData(e.currentTarget).get("playerName"))
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

    if(status == "loading") {
        return <div className="min-h-screen grid place-items-center text-ink-muted">Loading…</div>
    }

    if(status == "anonymous") {
        return <main className="min-h-screen grid place-items-center px-4 py-12">
            <div className="grid gap-8 justify-items-center w-full max-w-[400px]">
                <div className="flex gap-2 w-[260px]" aria-hidden="true">
                    {FAN.map(([row, col, flipped], k) => <div key={k} className="flex-1"
                        style={{ transform: `rotate(${(k - 2) * 5}deg) translateY(${Math.abs(k - 2) * 6}px)` }}>
                        <CharacterTile row={row} col={col} flipped={flipped} mode="static" />
                    </div>)}
                </div>
                <div className="text-center grid gap-2">
                    <h1 className="gw-wordmark">Guess <b>Who</b></h1>
                    <p className="text-ink-muted">Pick a character, ask yes/no questions, and flip down the rest.</p>
                </div>
                <form onSubmit={chooseName} className="gw-panel w-full" noValidate>
                    <div className={`gw-field${error ? " gw-field--error" : ""}`}>
                        <label htmlFor="playerName">Your name</label>
                        <input className="gw-input" id="playerName" name="playerName" maxLength={MAX_NAME_LENGTH}
                            placeholder="e.g. julian" autoComplete="nickname" required
                            aria-invalid={!!error} aria-describedby={error ? "playerName-error" : undefined} />
                        {error && <span className="gw-field__help" id="playerName-error">{error}</span>}
                    </div>
                    <Button variant="primary" size="lg" type="submit">Enter</Button>
                </form>
            </div>
        </main>
    }

    return <div className="min-h-screen">
        <header className="gw-topbar">
            <Link to="/" className="gw-logo">Guess <b>Who</b></Link>
            <span className="flex-1" />
            {player && <PlayerBadge name={player.name} seat={1} />}
        </header>
        <main className="gw-main">
            <ConnectionBanner />
            <Outlet />
        </main>
    </div>
}
