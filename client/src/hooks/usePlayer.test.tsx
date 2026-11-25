import { fetchMock, jsonResponse } from '../../test/utils'
import type * as RTL from '@testing-library/react'
import type { socket as SocketMock } from '../../test/socketMock'

// usePlayer keeps its state in the module and restores the session on import,
// so each test loads a fresh copy (after setting up storage and fetch). React,
// Testing Library and the socket come from the same fresh registry, or hooks
// would run against a second copy of React.
let renderHook: typeof RTL.renderHook
let act: typeof RTL.act
let waitFor: typeof RTL.waitFor
let socket: typeof SocketMock
let cleanup: (() => void) | undefined

afterEach(() => cleanup?.())

function load() {
    let usePlayer!: typeof import('./usePlayer').default
    jest.isolateModules(() => {
        // "pure" doesn't register its own afterEach; cleanup is called above.
        ({ renderHook, act, waitFor, cleanup } = require('@testing-library/react/pure'))
        socket = require('../../test/socketMock').socket
        usePlayer = require('./usePlayer').default
    })
    return { usePlayer }
}

const alice = { id: 'p1', name: 'Alice' }

test('anonymous without a stored token', () => {
    const { usePlayer } = load()
    const { result } = renderHook(() => usePlayer())
    expect(result.current.status).toBe('anonymous')
    expect(fetchMock()).not.toHaveBeenCalled()
})

test('restores a stored session and connects the socket', async () => {
    sessionStorage.setItem('token', 'tok')
    fetchMock().mockReturnValue(jsonResponse({ player: alice, graceSeconds: 45 }))
    const { usePlayer } = load()
    const { result } = renderHook(() => usePlayer())
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current).toMatchObject({ player: alice, graceSeconds: 45 })
    expect(fetchMock()).toHaveBeenCalledWith('/api/session', expect.anything())
    expect(socket.connect).toHaveBeenCalled()
})

test('an expired stored token logs out', async () => {
    sessionStorage.setItem('token', 'old')
    fetchMock().mockReturnValue(jsonResponse({}, 401))
    const { usePlayer } = load()
    const { result } = renderHook(() => usePlayer())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    expect(sessionStorage.getItem('token')).toBeNull()
    expect(socket.connect).not.toHaveBeenCalled()
})

test('a network error while restoring falls back to anonymous', async () => {
    sessionStorage.setItem('token', 'tok')
    fetchMock().mockReturnValue(Promise.reject(new Error('offline')))
    const { usePlayer } = load()
    const { result } = renderHook(() => usePlayer())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
})

test('login stores the token, becomes ready and connects', async () => {
    const { usePlayer } = load()
    fetchMock().mockReturnValue(jsonResponse({ token: 'new', player: alice, graceSeconds: 30 }))
    const { result } = renderHook(() => usePlayer())
    let ok
    await act(async () => { ok = await result.current.login('Alice') })
    expect(ok).toBe(true)
    expect(JSON.parse(fetchMock().mock.calls[0][1].body)).toEqual({ name: 'Alice' })
    expect(sessionStorage.getItem('token')).toBe('new')
    expect(result.current).toMatchObject({ status: 'ready', player: alice })
    expect(socket.connect).toHaveBeenCalled()
})

test('a failed login returns false and stays anonymous', async () => {
    const { usePlayer } = load()
    fetchMock().mockReturnValue(jsonResponse({ error: 'bad' }, 400))
    const { result } = renderHook(() => usePlayer())
    let ok
    await act(async () => { ok = await result.current.login('') })
    expect(ok).toBe(false)
    expect(result.current.status).toBe('anonymous')
    expect(sessionStorage.getItem('token')).toBeNull()
})

test('logout disconnects the socket', async () => {
    const { usePlayer } = load()
    fetchMock().mockReturnValue(jsonResponse({ token: 'new', player: alice, graceSeconds: 30 }))
    const { result } = renderHook(() => usePlayer())
    await act(async () => { await result.current.login('Alice') })
    act(() => result.current.logout())
    expect(result.current.status).toBe('anonymous')
    expect(socket.disconnect).toHaveBeenCalled()
})

test('a socket rejected as unauthorized logs out; other errors do not', async () => {
    const { usePlayer } = load()
    fetchMock().mockReturnValue(jsonResponse({ token: 'new', player: alice, graceSeconds: 30 }))
    const { result } = renderHook(() => usePlayer())
    await act(async () => { await result.current.login('Alice') })

    act(() => socket.trigger('connect_error', new Error('xhr poll error')))
    expect(result.current.status).toBe('ready')
    act(() => socket.trigger('connect_error', new Error('unauthorized')))
    expect(result.current.status).toBe('anonymous')
    expect(sessionStorage.getItem('token')).toBeNull()
})
