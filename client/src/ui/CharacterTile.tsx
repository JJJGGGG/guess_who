import { portraitSrc } from "./classes"

export type TileMode = "flip" | "pick" | "static"

type Props = {
    row: number,
    col: number,
    name?: string,
    flipped?: boolean,
    chosen?: boolean,
    mode?: TileMode,
    // Spectators see the second player's flipped tiles in their seat colour.
    opponent?: boolean,
    onClick?: () => void
}


// A character on the board. Flipping hinges the frame down on its bottom edge;
// the face stays in the DOM so the animation can run both ways.
export default function CharacterTile({ row, col, name, flipped = false, chosen = false, mode = "flip", opponent = false, onClick }: Props) {
    const label = name || `Character ${row * 6 + col + 1}`
    const classes = [
        "gw-tile",
        mode == "pick" && "gw-tile--pick",
        mode == "static" && "gw-tile--static",
        flipped && "is-flipped",
        chosen && "is-chosen",
        opponent && "gw-tile--opp",
    ].filter(Boolean).join(" ")

    const inner = <span className="gw-tile__inner">
        <span className="gw-tile__face">
            <img src={portraitSrc(row, col)} alt="" draggable={false} />
            {name && <span className="gw-tile__name">{name}</span>}
        </span>
        <span className="gw-tile__back" aria-hidden="true"><span>?</span></span>
    </span>

    if(mode == "static") {
        return <div className={classes} role="img" aria-label={flipped ? `${label}, flipped down` : label}>{inner}</div>
    }
    return <button type="button" className={classes} onClick={onClick} aria-label={label}
        aria-pressed={mode == "flip" ? flipped : chosen}>{inner}</button>
}
