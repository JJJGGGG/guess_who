import { useSyncExternalStore } from "react"
import { apiFetch, clearToken, getToken, onLogout, setToken } from "../api"
import { socket } from "../socket"
import type { NewSession, Player, SessionInfo } from "../../../shared/types"

type PlayerState = {
    status: "loading" | "anonymous" | "ready",
    player?: Player,
    graceSeconds: number,
}

let state: PlayerState = { status: getToken() ? "loading" : "anonymous", graceSeconds: 30 }
const listeners = new Set<() => void>()

function setState(next: PlayerState) {
    state = next
    listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

onLogout(() => {
    socket.disconnect()
    setState({ status: "anonymous", graceSeconds: state.graceSeconds })
})

// An expired or forged token is rejected by the socket.io middleware.
socket.on("connect_error", (err) => {
    if (err.message == "unauthorized") {
        clearToken()
    }
})

// Restore the session kept in sessionStorage (survives a refresh).
if (getToken()) {
    apiFetch("/session").then(async (res) => {
        if (res.ok) {
            const { player, graceSeconds }: SessionInfo = await res.json()
            setState({ status: "ready", player, graceSeconds })
            socket.connect()
        } else {
            clearToken()
        }
    }).catch(() => setState({ status: "anonymous", graceSeconds: state.graceSeconds }))
}

async function login(name: string) {
    const res = await apiFetch("/session", {
        method: "POST",
        body: JSON.stringify({ name })
    })
    if (!res.ok) {
        return false
    }
    const { token, player, graceSeconds }: NewSession = await res.json()
    setToken(token)
    setState({ status: "ready", player, graceSeconds })
    socket.connect()
    return true
}

export default function usePlayer() {
    const current = useSyncExternalStore(subscribe, () => state)
    return { ...current, login, logout: clearToken }
}
