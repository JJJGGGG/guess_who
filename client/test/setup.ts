import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'node:util'
import { socket } from './socketMock'

// jest-environment-jsdom doesn't expose these; React Router v7 needs them at import time.
Object.assign(globalThis, { TextEncoder, TextDecoder })

// Not implemented by jsdom; Chat scrolls to the newest message.
Element.prototype.scrollIntoView = jest.fn()

beforeEach(() => {
    sessionStorage.clear()
    socket.reset()
    global.fetch = jest.fn()
})
