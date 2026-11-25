import { useEffect, useState } from "react"
import { socket } from "../socket"
import { apiFetch } from "../api"

type Message = {
    playerId: string,
    player: string,
    message: string,
}

type StoredMessage = {playerId: string, playerName: string, message: string}

function toMessage(msg: StoredMessage): Message {
    return {
        playerId: msg.playerId,
        player: msg.playerName,
        message: msg.message
    }
}

export default function useMessages(roomId?: string): [Message[], (msg: string) => void] {
    const [messages, setMessages] = useState<Message[]>([]);

    async function postMessage(message: string) {
        const res = await apiFetch("/rooms/message", {
            method: "POST",
            body: JSON.stringify({
                message: message,
                roomId: parseInt(roomId || "")
            })
        })
        if(!res.ok) {
            return
        }
        const msgs = await res.json()

        setMessages(msgs.map(toMessage))
    }

    async function fetchMessages() {
        const msgs = await apiFetch(
            "/rooms/message?" + new URLSearchParams({
                roomId: roomId || "",
            }).toString()).then((res) => res.json())

        setMessages(msgs.map(toMessage))
    }

    function addMessage(msg: StoredMessage) {
        setMessages([...messages, toMessage(msg)])

    }

    useEffect(() => {
        fetchMessages();
    }, [roomId])

    useEffect(() => {
        function updateChat({rid, newMessage, playerId, playerName}: {rid: string, newMessage: string, playerId: string, playerName: string}) {
            if (rid == roomId) {
                addMessage({playerId, playerName, message: newMessage})
            }
        }
        socket.on("updateChat", updateChat)

        return () => {
            socket.off("updateChat", updateChat)
        }
    }, [roomId, addMessage])

    return [messages, postMessage]
}
