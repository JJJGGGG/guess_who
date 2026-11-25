import { useEffect, useState } from "react"
import { socket } from "../socket"
import { apiFetch } from "../api"
import type { ChatMessage, ChatUpdate } from "../../../shared/types"

type Message = {
    playerId: string,
    player: string,
    message: string,
}

type StoredMessage = Pick<ChatMessage, 'playerId' | 'playerName' | 'message'>

function toMessage(msg: StoredMessage): Message {
    return {
        playerId: msg.playerId,
        player: msg.playerName,
        message: msg.message
    }
}

export default function useMessages(roomId?: string): [Message[], (msg: string) => Promise<boolean>] {
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
            return false
        }
        const msgs: ChatMessage[] = await res.json()

        setMessages(msgs.map(toMessage))
        return true
    }

    useEffect(() => {
        // An error (e.g. unknown room) leaves the chat empty, and a response
        // that arrives after switching rooms is dropped.
        let cancelled = false
        apiFetch("/rooms/message?" + new URLSearchParams({ roomId: roomId || "" }).toString())
            .then((res) => res.ok ? res.json() : [])
            .then((msgs: ChatMessage[]) => { if (!cancelled) setMessages(msgs.map(toMessage)) })
            .catch(console.error)
        return () => { cancelled = true }
    }, [roomId])

    useEffect(() => {
        function updateChat({rid, newMessage, playerId, playerName}: ChatUpdate) {
            if (String(rid) === roomId) {
                setMessages((prev) => [...prev, toMessage({playerId, playerName, message: newMessage})])
            }
        }
        socket.on("updateChat", updateChat)

        return () => {
            socket.off("updateChat", updateChat)
        }
    }, [roomId])

    return [messages, postMessage]
}
