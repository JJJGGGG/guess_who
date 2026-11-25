import { useEffect, useRef, useState } from "react";
import useMessages from "./hooks/useMessages";
import usePlayer from "./hooks/usePlayer";
import { useParams } from "react-router-dom";
import { string, ValidationError } from "yup";

const MAX_MESSAGE_LENGTH = 500

const messageSchema = string()
    .trim()
    .required("Write a message first")
    .max(MAX_MESSAGE_LENGTH, `Messages can be at most ${MAX_MESSAGE_LENGTH} characters`)

// Spectators can read the chat but only players can post.
export default function Chat({ readOnly = false }: { readOnly?: boolean }) {
    const {roomId} = useParams();
    const { player } = usePlayer()
    const [messages, addMessage] = useMessages(roomId);

    const [curMsg, setCurMsg] = useState("")
    const [error, setError] = useState("")

    const scrollref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(scrollref.current) {
            scrollref.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    async function send() {
        let message: string
        try {
            message = await messageSchema.validate(curMsg)
        } catch (e) {
            if (e instanceof ValidationError) {
                setError(e.message)
                return
            }
            throw e
        }
        setError("")
        if (await addMessage(message)) {
            setCurMsg("")
        } else {
            setError("Couldn't send the message, try again")
        }
    }

    return (
        <div>
            <div className="font-bold">Chat</div>
            <div className="h-40 overflow-scroll border rounded lg:w-1/2 gap-y-2 flex flex-col mb-2">
                {messages.map((message, i) => (
                    message.playerId === player?.id ? (
                        <div key={i} className="flex justify-end">
                            <div className="px-2 py-1 border rounded inline-block">
                                <span className="font-bold">You:</span>{" "}
                                <span>{message.message}</span>
                            </div>
                        </div>
                    ) : (
                        <div key={i}>
                            <div className=" px-2 py-1 border rounded inline-block">
                                <span className="font-bold">{message.player}:</span>{" "}
                                <span>{message.message}</span>
                            </div>
                        </div>
                    )
                ))}
                <div ref={scrollref}></div>
            </div>
            {!readOnly && <div>
                <input className="border border-2 mr-2 rounded px-2 py-1" value={curMsg} maxLength={MAX_MESSAGE_LENGTH} onChange={(e) => setCurMsg(e.target.value)} />
                <button className="rounded text-white bg-sky-600 px-2 py-1 mb-2" onClick={send}>Enviar</button>
                {error && <div className="text-red-600 text-sm">{error}</div>}
            </div>}
        </div>
    )
}
