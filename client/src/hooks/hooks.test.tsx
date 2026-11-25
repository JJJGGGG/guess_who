import { act, renderHook, waitFor } from '@testing-library/react'
import { fetchMock, jsonResponse } from '../../test/utils'
import { socket } from '../../test/socketMock'
import useRoom from './useRoom'
import useRooms from './useRooms'
import useBoard from './useBoard'
import useMessages from './useMessages'
import useWatch from './useWatch'

const room = (id: number, names: string[] = []) => ({
    id,
    boards: names.map((n, i) => ({ id: i + 1, playerId: n, playerName: n, ready: false, tiles: [] })),
})

describe('useWatch', () => {
    test('watches on mount when connected and again on every reconnect', () => {
        socket.connected = true
        const { unmount } = renderHook(() => useWatch(7))
        expect(socket.emit).toHaveBeenCalledWith('watch', 7)
        socket.emit.mockClear()
        act(() => socket.trigger('connect'))
        expect(socket.emit).toHaveBeenCalledWith('watch', 7)
        unmount()
        expect(socket.listenerCount('connect')).toBe(0)
    })

    test('waits for the connection when offline', () => {
        renderHook(() => useWatch('lobby'))
        expect(socket.emit).not.toHaveBeenCalled()
        act(() => socket.trigger('connect'))
        expect(socket.emit).toHaveBeenCalledWith('watch', 'lobby')
    })

    test.each([undefined, NaN])('does nothing for %p', (target) => {
        socket.connected = true
        renderHook(() => useWatch(target))
        expect(socket.emit).not.toHaveBeenCalled()
    })
})

describe('useRoom', () => {
    test('loads the room and applies updates for that room only', async () => {
        fetchMock().mockReturnValue(jsonResponse(room(3, ['a'])))
        const { result } = renderHook(() => useRoom('3'))
        await waitFor(() => expect(result.current[0]).toEqual(room(3, ['a'])))
        expect(fetchMock()).toHaveBeenCalledWith('/api/rooms/3')

        act(() => socket.trigger('updateRoom', room(4, ['x'])))
        expect(result.current[0]?.id).toBe(3)
        act(() => socket.trigger('updateRoom', room(3, ['a', 'b'])))
        expect(result.current[0]?.boards).toHaveLength(2)
    })

    test('a null update means the room was deleted', async () => {
        fetchMock().mockReturnValue(jsonResponse(room(3)))
        const { result } = renderHook(() => useRoom('3'))
        await waitFor(() => expect(result.current[0]).toBeDefined())
        act(() => socket.trigger('updateRoom', null))
        expect(result.current[0]).toBeNull()
    })

    test('is null for an unknown room', async () => {
        fetchMock().mockReturnValue(jsonResponse({}, 404))
        const { result } = renderHook(() => useRoom('99'))
        await waitFor(() => expect(result.current[0]).toBeNull())
    })
})

describe('useRooms', () => {
    test('loads the lobby and replaces it on updateRooms', async () => {
        fetchMock().mockReturnValue(jsonResponse([room(1)]))
        const { result } = renderHook(() => useRooms())
        await waitFor(() => expect(result.current[0]).toHaveLength(1))
        act(() => socket.trigger('updateRooms', [room(1), room(2)]))
        expect(result.current[0]).toHaveLength(2)
    })

    test('an error loading the lobby leaves it empty', async () => {
        fetchMock().mockReturnValue(jsonResponse({ error: 'internal' }, 500))
        const { result } = renderHook(() => useRooms())
        await act(() => new Promise((r) => setTimeout(r, 20)))
        expect(result.current[0]).toEqual([])
    })
})

describe('useBoard', () => {
    const board = (roomId: number, chosenRow: number | null = null) =>
        ({ id: 1, roomId, playerId: 'me', playerName: 'me', chosenRow, chosenCol: chosenRow, tiles: [] })

    test('loads with auth, refetches on reconnect, ignores other rooms', async () => {
        sessionStorage.setItem('token', 'tok')
        fetchMock().mockReturnValue(jsonResponse(board(5)))
        const { result } = renderHook(() => useBoard('5'))
        await waitFor(() => expect(result.current[0]).toEqual(board(5)))
        expect(fetchMock().mock.calls[0][0]).toBe('/api/rooms/5/board')
        expect(fetchMock().mock.calls[0][1].headers.Authorization).toBe('Bearer tok')

        act(() => socket.trigger('board', board(6, 1)))
        expect(result.current[0]?.roomId).toBe(5)
        act(() => socket.trigger('board', board(5, 2)))
        expect(result.current[0]?.chosenRow).toBe(2)

        fetchMock().mockReturnValue(jsonResponse(board(5, 4)))
        act(() => socket.trigger('connect'))
        await waitFor(() => expect(result.current[0]?.chosenRow).toBe(4))
    })

    test('switchTile posts the numeric room and cell', async () => {
        fetchMock().mockReturnValue(jsonResponse(board(5)))
        const { result } = renderHook(() => useBoard('5'))
        await waitFor(() => expect(result.current[0]).toBeDefined())
        act(() => result.current[1](2, 3))
        const [path, init] = fetchMock().mock.calls.at(-1)
        expect(path).toBe('/api/rooms/tiles/flip')
        expect(JSON.parse(init.body)).toEqual({ roomId: 5, row: 2, col: 3 })
    })

    test('a late response for a previous room is dropped', async () => {
        let resolveOld!: (r: Response) => void
        fetchMock()
            .mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
            .mockReturnValueOnce(jsonResponse(board(2)))
        const { result, rerender } = renderHook(({ id }) => useBoard(id), { initialProps: { id: '1' } })
        rerender({ id: '2' })
        await waitFor(() => expect(result.current[0]?.roomId).toBe(2))
        await act(async () => { resolveOld(await jsonResponse(board(1))) })
        expect(result.current[0]?.roomId).toBe(2)
    })
})

describe('useMessages', () => {
    const stored = (message: string, playerName = 'bob') => ({ playerId: playerName, playerName, message })

    test('loads history and appends live messages for this room only', async () => {
        fetchMock().mockReturnValue(jsonResponse([stored('hi')]))
        const { result } = renderHook(() => useMessages('3'))
        await waitFor(() => expect(result.current[0]).toEqual([{ playerId: 'bob', player: 'bob', message: 'hi' }]))
        expect(fetchMock().mock.calls[0][0]).toBe('/api/rooms/message?roomId=3')

        act(() => socket.trigger('updateChat', { rid: 4, newMessage: 'elsewhere', playerId: 'x', playerName: 'x' }))
        act(() => socket.trigger('updateChat', { rid: 3, newMessage: 'yo', playerId: 'al', playerName: 'al' }))
        expect(result.current[0].map((m) => m.message)).toEqual(['hi', 'yo'])
    })

    test('posting replaces the list with the server copy', async () => {
        fetchMock().mockReturnValueOnce(jsonResponse([stored('one')]))
        const { result } = renderHook(() => useMessages('3'))
        await waitFor(() => expect(result.current[0]).toHaveLength(1))
        fetchMock().mockReturnValueOnce(jsonResponse([stored('one'), stored('two')]))
        let ok
        await act(async () => { ok = await result.current[1]('two') })
        expect(ok).toBe(true)
        expect(JSON.parse(fetchMock().mock.calls[1][1].body)).toEqual({ message: 'two', roomId: 3 })
        expect(result.current[0]).toHaveLength(2)
    })

    test('a rejected post returns false', async () => {
        fetchMock().mockReturnValueOnce(jsonResponse([])).mockReturnValueOnce(jsonResponse({}, 403))
        const { result } = renderHook(() => useMessages('3'))
        let ok
        await act(async () => { ok = await result.current[1]('x') })
        expect(ok).toBe(false)
    })

    test('an error loading history leaves the chat empty', async () => {
        const onError = jest.fn()
        process.on('unhandledRejection', onError)
        fetchMock().mockReturnValue(jsonResponse({ error: 'not found' }, 404))
        const { result } = renderHook(() => useMessages('99'))
        await waitFor(() => expect(fetchMock()).toHaveBeenCalled())
        await act(() => new Promise((r) => setTimeout(r, 20)))
        process.off('unhandledRejection', onError)
        expect(result.current[0]).toEqual([])
        expect(onError).not.toHaveBeenCalled()
    })

    test('history for a room the user already left is dropped', async () => {
        let resolveOld!: (r: Response) => void
        fetchMock()
            .mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
            .mockReturnValueOnce(jsonResponse([stored('room two')]))
        const { result, rerender } = renderHook(({ id }) => useMessages(id), { initialProps: { id: '1' } })
        rerender({ id: '2' })
        await waitFor(() => expect(result.current[0]).toHaveLength(1))
        await act(async () => { resolveOld(await jsonResponse([stored('a'), stored('b')])) })
        expect(result.current[0].map((m) => m.message)).toEqual(['room two'])
    })
})
