import type { ReactNode } from "react"

// The 6 × 6 tray the tiles stand in.
export default function Board({ label, children }: { label: string, children: ReactNode }) {
    return <div className="gw-board" role="group" aria-label={label}>{children}</div>
}
