export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"

// Full class names so Tailwind's content scan keeps them.
const VARIANT: Record<ButtonVariant, string> = {
    primary: "gw-btn--primary",
    secondary: "gw-btn--secondary",
    danger: "gw-btn--danger",
    ghost: "gw-btn--ghost",
}
const SIZE: Record<ButtonSize, string> = { sm: "gw-btn--sm", md: "", lg: "gw-btn--lg" }

// For links styled as buttons.
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = "") {
    return ["gw-btn", VARIANT[variant], SIZE[size], extra].filter(Boolean).join(" ")
}

export const portraitSrc = (row: number, col: number) => `/${row}_${col}.webp`
