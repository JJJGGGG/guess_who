import { useEffect, useState } from "react";
import { socket } from "./socket";
import Banner from "./ui/Banner";
import { LoaderIcon, WifiOffIcon } from "./ui/icons";

// Tells this tab that its own socket dropped. socket.io reconnects on its own;
// on localhost it does not react to the browser's "offline" event, so this
// appears once the heartbeat times out.
export default function ConnectionBanner() {
    // Only after a real disconnect, so it doesn't flash before the first connect.
    const [lost, setLost] = useState(false)

    useEffect(() => {
        const onConnect = () => setLost(false)
        const onDisconnect = () => setLost(true)
        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        return () => {
            socket.off("connect", onConnect)
            socket.off("disconnect", onDisconnect)
        }
    }, [])

    if(!lost) {
        return null
    }

    return <Banner variant="danger" icon={<WifiOffIcon size={20} />} trailing={<LoaderIcon size={20} className="gw-spin" />}>
        <b>Connection lost.</b> Reconnecting…
    </Banner>
}
