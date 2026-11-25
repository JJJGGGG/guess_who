const TOKEN_KEY = "token";

const listeners = new Set<() => void>();

export function getToken(): string | null {
    try {
        return sessionStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token: string) {
    try {
        sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
        // storage unavailable: the session lasts until the page is reloaded
    }
}

export function clearToken() {
    try {
        sessionStorage.removeItem(TOKEN_KEY);
    } catch {
        // ignore
    }
    listeners.forEach((l) => l());
}

// Called whenever the token is cleared, e.g. after a 401.
export function onLogout(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener) };
}

export async function apiFetch(path: string, init: RequestInit = {}) {
    const token = getToken();
    const res = await fetch("/api" + path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init.headers,
        },
    });
    if (res.status == 401) {
        clearToken();
    }
    return res;
}
