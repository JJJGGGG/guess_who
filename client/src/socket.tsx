import { io } from 'socket.io-client';
import { getToken } from './api';

// Connected by usePlayer once a token exists. The auth callback runs on every
// (re)connect, so reconnects always send the current token.
// No URL: connects to the page's own origin, which also serves the API.
export const socket = io({
    autoConnect: false,
    auth: (cb) => cb({ token: getToken() }),
});

// Dev only: lets you drop this tab's connection from the console to test the
// grace period, e.g. `socket.io.engine.close()` (reconnects like a real drop).
if (import.meta.env.DEV) {
    (window as any).socket = socket;
}
