import { useEffect, useState } from "react"
import { socket } from "../socket"

type Message = {
    player: string,
    message: string,
}

export default function useMessages(playerId?: string, roomId?: string): [Message[], (msg: string) => void] {
    const [messages, setMessages] = useState<Message[]>([]);

    async function postMessage(message: string) {
        const msgs = await fetch(
            import.meta.env.VITE_BACKEND_URL + "/rooms/message", {
            headers: {
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify({
                message: message,
                playerId: playerId,
                roomId: parseInt(roomId || "")
            })
        }).then((res) => res.json())

        setMessages(msgs.map((msg: {playerId: string, message: string}) => ({
            player: msg.playerId,
            message: msg.message
        })))
    }

    async function fetchMessages() {
        const msgs = await fetch(
            import.meta.env.VITE_BACKEND_URL + "/rooms/message?" + new URLSearchParams({
                roomId: roomId || "",
            }).toString()).then((res) => res.json())

        setMessages(msgs.map((msg: {playerId: string, message: string}) => ({
            player: msg.playerId,
            message: msg.message
        })))
    }

    function addMessage(newMessage: string, playerId: string) {
        setMessages([...messages, {player: playerId, message: newMessage}])

    }

    useEffect(() => {
        fetchMessages();
    }, [roomId, playerId])

    useEffect(() => {
        function updateChat({rid, newMessage, playerId}: {rid: string, newMessage: string, playerId: string}) {
            if (rid == roomId) {
                addMessage(newMessage, playerId)
            }
        }
        socket.on("updateChat", updateChat)

        return () => {
            socket.off("updateChat", updateChat)
        }
    }, [roomId, addMessage])

    return [messages, postMessage]
}
