import { FormEvent, useEffect, useRef, useState } from "react";
import useMessages from "./hooks/useMessages";
import usePlayer from "./hooks/usePlayer";
import { useParams } from "react-router-dom";
import { string, ValidationError } from "yup";
import Button from "./ui/Button";
import { SendIcon } from "./ui/icons";

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

    const logRef = useRef<HTMLDivElement>(null);

    // Scroll the log itself, not the page, to the newest message.
    useEffect(() => {
        const log = logRef.current
        if(log) {
            log.scrollTop = log.scrollHeight
        }
    }, [messages])

    async function send(e: FormEvent) {
        e.preventDefault()
        let message: string
        try {
            message = await messageSchema.validate(curMsg)
        } catch (err) {
            if (err instanceof ValidationError) {
                setError(err.message)
                return
            }
            throw err
        }
        setError("")
        if (await addMessage(message)) {
            setCurMsg("")
        } else {
            setError("Couldn't send the message, try again")
        }
    }

    return (
        <div className="grid gap-3 min-w-0">
            <h2 className="gw-label">Chat</h2>
            <div ref={logRef} className="gw-chat__log h-72" aria-live="polite">
                {messages.length == 0 && <p className="gw-chat__empty">
                    {readOnly ? "No messages yet." : "No messages yet. Ask a yes/no question to start."}
                </p>}
                {messages.map((message, i) => {
                    const mine = message.playerId === player?.id
                    // Name once per run of messages from the same person.
                    const showName = i == 0 || messages[i - 1].playerId !== message.playerId
                    return <div key={i} className={`gw-msg ${mine ? "gw-msg--mine" : "gw-msg--theirs"}`}>
                        {showName && <span className="gw-msg__who">{mine ? "You" : message.player}</span>}
                        <span className="gw-msg__body">{message.message}</span>
                    </div>
                })}
            </div>
            {readOnly
                ? <p className="text-center text-[13px] leading-[18px] text-ink-muted">Only players can chat.</p>
                : <form className="grid gap-1" onSubmit={send} noValidate>
                    <div className="gw-inline">
                        <input className="gw-input" value={curMsg} maxLength={MAX_MESSAGE_LENGTH} aria-label="Message"
                            placeholder="Ask a yes/no question" onChange={(e) => setCurMsg(e.target.value)} />
                        <Button variant="primary" type="submit"><SendIcon />Send</Button>
                    </div>
                    {error && <div className="gw-error" role="alert">{error}</div>}
                </form>}
        </div>
    )
}
