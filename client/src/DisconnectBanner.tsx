import { useEffect, useState } from "react";
import type { Room } from "../../shared/types";
import usePlayer from "./hooks/usePlayer";
import Banner from "./ui/Banner";
import { ClockIcon } from "./ui/icons";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

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
            return <Banner key={b.id} variant="warn" icon={<ClockIcon size={20} />}>
                <b>{b.playerName} disconnected.</b> Waiting <span className="gw-code">{clock(left)}</span> for them to come back.
            </Banner>
        })}
    </>
}
