import { useEffect } from "react"
import { socket } from "../socket"

// Tells the server which page this tab shows, so it only sends that page's
// events. socket.io drops channels on reconnect, so it is re-sent on every
// connect. No unwatch on unmount: the next page's watch replaces it.
export default function useWatch(target: "lobby" | number | undefined) {
    useEffect(() => {
        if(target === undefined || Number.isNaN(target)) {
            return
        }
        function watch() {
            socket.emit("watch", target)
        }
        if(socket.connected) {
            watch()
        }
        socket.on("connect", watch)
        return () => {
            socket.off("connect", watch)
        }
    }, [target])
}
