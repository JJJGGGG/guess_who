import { useEffect, useRef, useState } from "react";
import useMessages from "./hooks/useMessages";
import { useParams, useSearchParams } from "react-router-dom";

export default function Chat() {
    const {roomId} = useParams();
    const [URLSearchParams] = useSearchParams()
    const [messages, addMessage] = useMessages(URLSearchParams.get("playerId") || undefined, roomId);

    const [curMsg, setCurMsg] = useState("")

    const scrollref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(scrollref.current) {
            scrollref.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])
    return (
        <div>
            <div className="font-bold">Chat</div>
            <div className="h-40 overflow-scroll border rounded lg:w-1/2 gap-y-2 flex flex-col mb-2">
                {messages.map(message => (
                    message.player === URLSearchParams.get("playerId") ? (
                        <div className="flex justify-end">
                            <div className="px-2 py-1 border rounded inline-block">
                                <span className="font-bold">You:</span>{" "}
                                <span>{message.message}</span>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className=" px-2 py-1 border rounded inline-block">
                                <span className="font-bold">{message.player}:</span>{" "}
                                <span>{message.message}</span>
                            </div>
                        </div>
                    )
                ))}
                <div ref={scrollref}></div>
            </div>
            <div>
                <input className="border border-2 mr-2 rounded px-2 py-1" value={curMsg} onChange={(e) => setCurMsg(e.target.value)} />
                <button className="rounded text-white bg-sky-600 px-2 py-1 mb-2" onClick={() => addMessage(curMsg)}>Enviar</button>
            </div>
        </div>
    )
}