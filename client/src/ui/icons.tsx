// Inline line icons (Lucide shapes): 1.75 stroke, coloured with currentColor.
import type { ReactNode } from "react"

function Icon({ size = 18, className, children }: { size?: number, className?: string, children: ReactNode }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{children}</svg>
}

type P = { size?: number, className?: string }

export const WifiOffIcon = (p: P) => <Icon {...p}>
    <path d="M2 2l20 20" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.9a10 10 0 0 1 5.2-2.8" />
    <path d="M19 12.9a10 10 0 0 0-2.1-1.6" /><path d="M2 8.8a15 15 0 0 1 4.2-2.6" /><path d="M22 8.8A15 15 0 0 0 10.7 5" /><path d="M12 20h.01" />
</Icon>
export const ClockIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
export const LoaderIcon = (p: P) => <Icon {...p}><path d="M21 12a9 9 0 1 1-6.2-8.6" /></Icon>
export const SendIcon = (p: P) => <Icon {...p}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></Icon>
export const LogOutIcon = (p: P) => <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
</Icon>
export const EyeIcon = (p: P) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>
