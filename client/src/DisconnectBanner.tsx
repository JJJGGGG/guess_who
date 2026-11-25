import { useEffect, useState } from "react";
import type { Room } from "../../shared/types";
import usePlayer from "./hooks/usePlayer";

// Shows a countdown for every other player in the room who is in their
// reconnect grace period.
export default function DisconnectBanner({ room }: { room?: Room }) {
    const { player, graceSeconds } = usePlayer()
    const [now, setNow] = useState(Date.now())

    const away = room?.boards.filter((b) => b.playerId != player?.id && b.disconnectedAt) ?? []

    useEffect(() => {
        if(!away.length) {
            return
        }
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [away.length])

    return <>
        {away.map((b) => {
            const left = Math.max(0, Math.ceil((Date.parse(b.disconnectedAt!) + graceSeconds * 1000 - now) / 1000))
            return <div key={b.id} className="rounded border border-yellow-500 bg-yellow-100 px-2 py-1 mb-2">
                {b.playerName} disconnected — waiting {left}s for them to come back...
            </div>
        })}
    </>
}
