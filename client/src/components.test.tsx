import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { fetchMock, jsonResponse } from '../test/utils'
import { socket } from '../test/socketMock'
import { renderAt } from '../test/render'
import { playerState, resetPlayer } from '../test/mockPlayer'
import Layout from './Layout'
import Chat from './Chat'
import Rooms from './Rooms'
import Room from './Room'
import Game from './Game'
import Spectate from './Spectate'
import DisconnectBanner from './DisconnectBanner'
import ConnectionBanner from './ConnectionBanner'
import type { Room as RoomT, Board } from '../../shared/types'

jest.mock('./hooks/usePlayer', () => require('../test/mockPlayer'))

beforeEach(resetPlayer)
afterEach(() => jest.useRealTimers())

// Lets pending fetches (initial loads) settle inside act.
const flush = () => act(async () => {})

const location = () => screen.getByTestId('location').textContent

const tiles = (flipped: number[] = []) =>
    Array.from({ length: 36 }, (_, i) => ({ row: Math.floor(i / 6), col: i % 6, flipped: flipped.includes(i) }))

function publicBoard(playerId: string, extra: Partial<RoomT['boards'][0]> = {}): RoomT['boards'][0] {
    return { id: playerId.length, playerId, playerName: playerId.toUpperCase(), ready: false, disconnectedAt: null, tiles: [], ...extra }
}

function ownBoard(chosen: [number, number] | null = null, flipped: number[] = []): Board {
    return {
        id: 1, roomId: 3, playerId: 'me', playerName: 'Me',
        chosenRow: chosen?.[0] ?? null, chosenCol: chosen?.[1] ?? null,
        tiles: tiles(flipped).map((t, i) => ({ ...t, id: i + 1, name: '', photoUrl: '' })),
    }
}

// Answers fetch by URL; unknown URLs get [] (e.g. chat history).
function serve(routes: Record<string, unknown>) {
    fetchMock().mockImplementation((url: string, init?: RequestInit) => {
        const key = `${init?.method?.toUpperCase() ?? 'GET'} ${url}`
        if (key in routes) {
            const v = routes[key]
            return typeof v === 'number' ? jsonResponse({}, v) : jsonResponse(v)
        }
        return jsonResponse([])
    })
}

const postsTo = (path: string) =>
    fetchMock().mock.calls.filter(([url, init]) => url === '/api' + path && init?.method?.toUpperCase() === 'POST')

describe('Layout', () => {
    const renderLayout = () => render(<MemoryRouter><Layout /></MemoryRouter>)

    test('loading and ready states', () => {
        playerState.status = 'loading'
        const { rerender } = renderLayout()
        expect(screen.getByText('Loading...')).toBeInTheDocument()
        playerState.status = 'ready'
        rerender(<MemoryRouter><Layout /></MemoryRouter>)
        expect(screen.getByText('Player name: Me')).toBeInTheDocument()
    })

    test('validates the name before logging in', async () => {
        playerState.status = 'anonymous'
        renderLayout()
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: '   ' } })
        fireEvent.submit(input.closest('form')!)
        expect(await screen.findByText('Enter a name')).toBeInTheDocument()
        expect(playerState.login).not.toHaveBeenCalled()
    })

    test('logs in with the trimmed name, shows an error if it fails', async () => {
        playerState.status = 'anonymous'
        playerState.login.mockResolvedValue(false)
        renderLayout()
        await userEvent.type(screen.getByRole('textbox'), '  Alice ')
        await userEvent.click(screen.getByRole('button', { name: 'Enter' }))
        expect(playerState.login).toHaveBeenCalledWith('Alice')
        expect(await screen.findByText("Couldn't start a session, try again")).toBeInTheDocument()
    })
})

describe('ConnectionBanner', () => {
    test('appears after a disconnect and hides on reconnect', () => {
        render(<ConnectionBanner />)
        expect(screen.queryByText(/Connection lost/)).toBeNull()
        act(() => socket.trigger('disconnect'))
        expect(screen.getByText(/Connection lost/)).toBeInTheDocument()
        act(() => socket.trigger('connect'))
        expect(screen.queryByText(/Connection lost/)).toBeNull()
    })
})

describe('Chat', () => {
    const renderChat = (readOnly = false) => renderAt(<Chat readOnly={readOnly} />, '/rooms/3', '/rooms/:roomId')

    test('shows own messages as "You" and others by name', async () => {
        serve({ 'GET /api/rooms/message?roomId=3': [
            { playerId: 'me', playerName: 'Me', message: 'mine' },
            { playerId: 'bob', playerName: 'Bob', message: 'theirs' },
        ] })
        renderChat()
        expect(await screen.findByText('mine')).toBeInTheDocument()
        expect(screen.getByText('You:')).toBeInTheDocument()
        expect(screen.getByText('Bob:')).toBeInTheDocument()
    })

    test('refuses an empty message', async () => {
        serve({})
        renderChat()
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
        expect(await screen.findByText('Write a message first')).toBeInTheDocument()
        expect(postsTo('/rooms/message')).toHaveLength(0)
    })

    test('sends and clears the input; keeps it on failure', async () => {
        serve({ 'POST /api/rooms/message': [{ playerId: 'me', playerName: 'Me', message: 'hello' }] })
        renderChat()
        const input = screen.getByRole('textbox')
        await userEvent.type(input, ' hello ')
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
        await waitFor(() => expect(input).toHaveValue(''))
        expect(JSON.parse(postsTo('/rooms/message')[0][1].body)).toEqual({ message: 'hello', roomId: 3 })

        serve({ 'POST /api/rooms/message': 403 })
        await userEvent.type(input, 'again')
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
        expect(await screen.findByText("Couldn't send the message, try again")).toBeInTheDocument()
        expect(input).toHaveValue('again')
    })

    test('read-only for spectators', () => {
        serve({})
        renderChat(true)
        expect(screen.queryByRole('textbox')).toBeNull()
        return flush()
    })
})

describe('Rooms', () => {
    const summary = (id: number, players: string[]) => ({ id, boards: players.map((p, i) => ({ id: i, playerId: p, playerName: p })) })

    test('Join only for rooms with a free seat that I am not in', async () => {
        serve({ 'GET /api/rooms': [summary(1, []), summary(2, ['a', 'b']), summary(3, ['me'])] })
        renderAt(<Rooms />, '/')
        await screen.findByText(/Room 1/)
        expect(screen.getAllByRole('button', { name: 'Join' })).toHaveLength(1)
        expect(screen.getByText(/Room 1/)).toContainElement(screen.getByRole('button', { name: 'Join' }))
        expect(screen.getAllByRole('link', { name: 'Spectate' })).toHaveLength(3)
    })

    test('joining navigates to the room; a refused join stays', async () => {
        serve({ 'GET /api/rooms': [summary(1, []), summary(2, [])], 'POST /api/rooms/join': 400 })
        renderAt(<Rooms />, '/')
        const [first] = await screen.findAllByRole('button', { name: 'Join' })
        await userEvent.click(first)
        expect(location()).toBe('/')

        serve({ 'GET /api/rooms': [], 'POST /api/rooms/join': {} })
        await userEvent.click(first)
        await waitFor(() => expect(location()).toBe('/rooms/1'))
    })

    test.each([
        [503, 'Too many rooms open, try again later'],
        [429, 'Too many rooms created, wait a minute'],
        [500, "Couldn't create the room"],
    ])('create room error %p', async (status, text) => {
        serve({ 'GET /api/rooms': [], 'POST /api/rooms': status })
        renderAt(<Rooms />, '/')
        await userEvent.click(screen.getByRole('button', { name: 'Create room' }))
        expect(await screen.findByText(text)).toBeInTheDocument()
    })

    test('lobby updates arrive over the socket', async () => {
        serve({ 'GET /api/rooms': [] })
        renderAt(<Rooms />, '/')
        await flush()
        act(() => socket.trigger('updateRooms', [summary(9, ['x'])]))
        expect(screen.getByText(/Room 9 \(1\/2\)/)).toBeInTheDocument()
    })
})

describe('Room', () => {
    const renderRoom = () => renderAt(<Room />, '/rooms/3', '/rooms/:roomId')

    test('Start only with two players', async () => {
        serve({ 'GET /api/rooms/3': { id: 3, boards: [publicBoard('me')] } })
        renderRoom()
        await screen.findByText('ME')
        expect(screen.queryByRole('button', { name: 'Start Game' })).toBeNull()
        act(() => socket.trigger('updateRoom', { id: 3, boards: [publicBoard('me'), publicBoard('bob')] }))
        await userEvent.click(screen.getByRole('button', { name: 'Start Game' }))
        expect(JSON.parse(postsTo('/rooms/start')[0][1].body)).toEqual({ roomId: 3 })
    })

    test('startGame for this room opens the game; other rooms are ignored', async () => {
        serve({ 'GET /api/rooms/3': { id: 3, boards: [] } })
        renderRoom()
        act(() => socket.trigger('startGame', 4))
        expect(location()).toBe('/rooms/3')
        act(() => socket.trigger('startGame', 3))
        expect(location()).toBe('/rooms/3/game')
    })

    test('leave posts and returns to the lobby', async () => {
        serve({ 'GET /api/rooms/3': { id: 3, boards: [publicBoard('me')] } })
        renderRoom()
        await userEvent.click(screen.getByRole('button', { name: 'Leave room' }))
        await waitFor(() => expect(location()).toBe('/'))
        expect(postsTo('/rooms/leave')).toHaveLength(1)
    })
})

describe('Game', () => {
    const renderGame = () => renderAt(<Game />, '/rooms/3/game', '/rooms/:roomId/game')
    const twoPlayers = { id: 3, boards: [publicBoard('me'), publicBoard('bob')] }

    test('pick a character first', async () => {
        serve({ 'GET /api/rooms/3': twoPlayers, 'GET /api/rooms/3/board': ownBoard() })
        const { container } = renderGame()
        expect(await screen.findByText('Select your character')).toBeInTheDocument()
        await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(36))
        await userEvent.click(container.querySelectorAll('img')[8])
        expect(JSON.parse(postsTo('/rooms/selectcharacter')[0][1].body)).toEqual({ roomId: 3, row: 1, col: 2 })
    })

    test('then the board with flipped tiles and my character', async () => {
        serve({ 'GET /api/rooms/3': twoPlayers, 'GET /api/rooms/3/board': ownBoard([4, 5], [0, 1]) })
        const { container } = renderGame()
        expect(await screen.findByText(/Your Character/)).toBeInTheDocument()
        const imgs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
        expect(imgs).toHaveLength(34 + 1)
        expect(imgs).not.toContain('/0_0.webp')
        expect(imgs.at(-1)).toBe('/4_5.webp')

        await userEvent.click(container.querySelector('img[src="/2_3.webp"]')!)
        expect(JSON.parse(postsTo('/rooms/tiles/flip')[0][1].body)).toEqual({ roomId: 3, row: 2, col: 3 })
    })

    test('back to the lobby when my own board is gone', async () => {
        serve({ 'GET /api/rooms/3': { id: 3, boards: [publicBoard('bob')] }, 'GET /api/rooms/3/board': 404 })
        renderGame()
        await waitFor(() => expect(location()).toBe('/'))
    })

    test('when the opponent leaves, says so and returns to the room', async () => {
        jest.useFakeTimers()
        serve({ 'GET /api/rooms/3': twoPlayers, 'GET /api/rooms/3/board': ownBoard([0, 0]) })
        renderGame()
        await act(() => jest.advanceTimersByTimeAsync(0))
        act(() => socket.trigger('updateRoom', { id: 3, boards: [publicBoard('me')] }))
        expect(screen.getByText('BOB left the game. Returning to the room...')).toBeInTheDocument()
        expect(location()).toBe('/rooms/3/game')
        act(() => jest.advanceTimersByTime(3000))
        expect(location()).toBe('/rooms/3')
    })
})

describe('Spectate', () => {
    const renderSpectate = () => renderAt(<Spectate />, '/rooms/3/spectate', '/rooms/:roomId/spectate')

    test('players are sent to their game page', async () => {
        serve({ 'GET /api/rooms/3': { id: 3, boards: [publicBoard('me'), publicBoard('bob')] } })
        renderSpectate()
        await waitFor(() => expect(location()).toBe('/rooms/3/game'))
    })

    test('waits until both boards exist', async () => {
        serve({ 'GET /api/rooms/3': { id: 3, boards: [publicBoard('al', { tiles: tiles() }), publicBoard('bob')] } })
        renderSpectate()
        expect(await screen.findByText('Waiting for players to join...')).toBeInTheDocument()
    })

    test('shows both boards and who has chosen, never which character', async () => {
        serve({ 'GET /api/rooms/3': { id: 3, boards: [
            publicBoard('al', { tiles: tiles([0]), ready: true }),
            publicBoard('bob', { tiles: tiles() }),
        ] } })
        const { container } = renderSpectate()
        expect(await screen.findByText("AL's board")).toBeInTheDocument()
        expect(screen.getByText('Character chosen ✓')).toBeInTheDocument()
        expect(screen.getByText('Choosing a character...')).toBeInTheDocument()
        expect(container.querySelectorAll('img')).toHaveLength(35 + 36)
        expect(screen.queryByRole('textbox')).toBeNull()
    })
})

describe('DisconnectBanner', () => {
    test('counts down for other players only', () => {
        jest.useFakeTimers({ now: new Date('2026-01-01T00:00:10Z') })
        playerState.graceSeconds = 30
        const room = { id: 3, boards: [
            publicBoard('me', { disconnectedAt: '2026-01-01T00:00:00Z' }),
            publicBoard('bob', { disconnectedAt: '2026-01-01T00:00:00Z' }),
        ] }
        render(<DisconnectBanner room={room} />)
        expect(screen.getByText('BOB disconnected — waiting 20s for them to come back...')).toBeInTheDocument()
        expect(screen.queryByText(/ME disconnected/)).toBeNull()
        act(() => jest.advanceTimersByTime(5000))
        expect(screen.getByText(/waiting 15s/)).toBeInTheDocument()
        act(() => jest.advanceTimersByTime(60000))
        expect(screen.getByText(/waiting 0s/)).toBeInTheDocument()
    })

    test('renders nothing when everyone is connected', () => {
        const { container } = render(<DisconnectBanner room={{ id: 3, boards: [publicBoard('bob')] }} />)
        expect(container).toBeEmptyDOMElement()
    })
})
