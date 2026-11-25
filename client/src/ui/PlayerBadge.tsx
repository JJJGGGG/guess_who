import type { ReactNode } from "react"

export type PlayerStatus = { kind: "ready" | "choosing" | "away", text: ReactNode }

type Props = { name?: string, seat: 1 | 2, you?: boolean, status?: PlayerStatus }

// Seat 1 (cobalt) is you, seat 2 (tangerine) the opponent; spectators see seat order.
export default function PlayerBadge({ name, seat, you, status }: Props) {
    if(!name) {
        return <span className="gw-player gw-player--empty">
            <span className="gw-player__seat" aria-hidden="true">{seat}</span>
            <span className="gw-player__name">Open seat</span>
        </span>
    }
    const statusClass = status?.kind == "ready" ? " is-ready" : status?.kind == "away" ? " is-away" : ""
    return <span className={`gw-player ${seat == 1 ? "gw-player--1" : "gw-player--2"}`}>
        <span className="gw-player__seat" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span className="gw-player__name">{name}</span>
        {you && <span className="gw-player__you">(you)</span>}
        {status && <span className={`gw-player__status${statusClass}`}>{status.text}</span>}
    </span>
}
