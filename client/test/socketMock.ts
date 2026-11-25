// Stands in for client/src/socket.tsx. Records emits and lets tests deliver
// server events with `socket.trigger(event, payload)`.
type Handler = (...args: any[]) => void

const handlers = new Map<string, Set<Handler>>()

type SocketMock = {
    connected: boolean,
    on: jest.Mock<SocketMock, [string, Handler]>,
    off: jest.Mock<SocketMock, [string, Handler]>,
    emit: jest.Mock,
    connect: jest.Mock,
    disconnect: jest.Mock,
    trigger(event: string, ...args: any[]): void,
    listenerCount(event: string): number,
    reset(): void,
}

export const socket: SocketMock = {
    connected: false,
    on: jest.fn((event: string, handler: Handler) => {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event)!.add(handler)
        return socket
    }),
    off: jest.fn((event: string, handler: Handler) => {
        handlers.get(event)?.delete(handler)
        return socket
    }),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    trigger(event: string, ...args: any[]) {
        handlers.get(event)?.forEach((h) => h(...args))
    },
    listenerCount(event: string) {
        return handlers.get(event)?.size ?? 0
    },
    // Called before each test. Module-level listeners (usePlayer's
    // connect_error) are kept, since that module isn't re-imported.
    reset() {
        socket.connected = false
        socket.emit.mockClear()
        socket.connect.mockClear()
        socket.disconnect.mockClear()
    },
}
