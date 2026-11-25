import '@testing-library/jest-dom'
import { socket } from './socketMock'

// Not implemented by jsdom; Chat scrolls to the newest message.
Element.prototype.scrollIntoView = jest.fn()

// React Router v6 announces v7 behaviour changes on every render; not relevant here.
const warn = console.warn
jest.spyOn(console, 'warn').mockImplementation((...args) => {
    if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) return
    warn(...args)
})

beforeEach(() => {
    sessionStorage.clear()
    socket.reset()
    global.fetch = jest.fn()
})
