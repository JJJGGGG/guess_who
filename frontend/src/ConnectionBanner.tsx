import { useEffect, useState } from "react";
import { socket } from "./socket";

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

    return <div className="rounded border border-red-500 bg-red-100 px-2 py-1 mb-2">
        Connection lost — reconnecting...
    </div>
}
