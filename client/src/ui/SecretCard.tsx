import { useState } from "react"
import { portraitSrc } from "./classes"

// The player's hidden character. Can be blurred for when someone is looking over your shoulder.
export default function SecretCard({ row, col, name }: { row: number, col: number, name?: string }) {
    const [hidden, setHidden] = useState(false)
    return <div className={`gw-secret${hidden ? " is-hidden" : ""}`}>
        <div className="gw-secret__frame"><img src={portraitSrc(row, col)} alt={hidden ? "" : name || "Your character"} /></div>
        <div className="grid">
            <div className="gw-label">Your character</div>
            <div className="gw-secret__name">{hidden ? "Hidden" : name || `#${row * 6 + col + 1}`}</div>
            <button type="button" className="gw-secret__toggle" onClick={() => setHidden(!hidden)}>
                {hidden ? "Show" : "Hide"}
            </button>
        </div>
    </div>
}
