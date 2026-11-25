import type { ButtonHTMLAttributes } from "react"
import { buttonClass, type ButtonSize, type ButtonVariant } from "./classes"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant, size?: ButtonSize }

export default function Button({ variant = "secondary", size = "md", className = "", type = "button", ...props }: Props) {
    return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}
