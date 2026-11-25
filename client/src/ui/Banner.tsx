import type { ReactNode } from "react"

// Full class names so Tailwind's content scan keeps them.
const VARIANT = { danger: "gw-banner--danger", warn: "gw-banner--warn", info: "gw-banner--info" }

type Props = { variant: "danger" | "warn" | "info", icon: ReactNode, trailing?: ReactNode, children: ReactNode }

// Inline status strip. Not dismissible: it goes away when its state clears.
export default function Banner({ variant, icon, trailing, children }: Props) {
    return <div role="status" className={`gw-banner ${VARIANT[variant]}`}>
        <span className="gw-banner__icon">{icon}</span>
        <span className="gw-banner__text">{children}</span>
        {trailing}
    </div>
}
