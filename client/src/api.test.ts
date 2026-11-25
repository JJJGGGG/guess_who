import { apiFetch, clearToken, getToken, onLogout, setToken } from './api'
import { fetchMock, jsonResponse } from '../test/utils'

describe('token storage', () => {
    test('set, get and clear', () => {
        expect(getToken()).toBeNull()
        setToken('abc')
        expect(getToken()).toBe('abc')
        expect(sessionStorage.getItem('token')).toBe('abc')
        clearToken()
        expect(getToken()).toBeNull()
    })

    test('clearToken notifies logout listeners until unsubscribed', () => {
        const listener = jest.fn()
        const off = onLogout(listener)
        clearToken()
        expect(listener).toHaveBeenCalledTimes(1)
        off()
        clearToken()
        expect(listener).toHaveBeenCalledTimes(1)
    })

    test('survives storage that throws', () => {
        const spies = (['getItem', 'setItem', 'removeItem'] as const).map((m) =>
            jest.spyOn(Storage.prototype, m).mockImplementation(() => { throw new Error('blocked') }))
        expect(getToken()).toBeNull()
        expect(() => setToken('x')).not.toThrow()
        expect(() => clearToken()).not.toThrow()
        spies.forEach((s) => s.mockRestore())
    })
})

describe('apiFetch', () => {
    test('prefixes /api and sends JSON without auth when logged out', async () => {
        fetchMock().mockReturnValue(jsonResponse({}))
        await apiFetch('/rooms')
        expect(fetchMock()).toHaveBeenCalledWith('/api/rooms', { headers: { 'Content-Type': 'application/json' } })
    })

    test('adds the bearer token and keeps caller options and headers', async () => {
        setToken('tok')
        fetchMock().mockReturnValue(jsonResponse({}))
        await apiFetch('/rooms/join', { method: 'POST', body: '{}', headers: { 'X-Extra': '1' } })
        expect(fetchMock()).toHaveBeenCalledWith('/api/rooms/join', {
            method: 'POST',
            body: '{}',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok', 'X-Extra': '1' },
        })
    })

    test('a 401 clears the token and logs out', async () => {
        setToken('expired')
        const listener = jest.fn()
        const off = onLogout(listener)
        fetchMock().mockReturnValue(jsonResponse({}, 401))
        const res = await apiFetch('/session')
        expect(res.status).toBe(401)
        expect(getToken()).toBeNull()
        expect(listener).toHaveBeenCalled()
        off()
    })

    test('other errors keep the token', async () => {
        setToken('tok')
        fetchMock().mockReturnValue(jsonResponse({}, 403))
        await apiFetch('/rooms/leave')
        expect(getToken()).toBe('tok')
    })
})
