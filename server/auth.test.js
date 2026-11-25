const crypto = require('crypto')
const { sign, verify, requireAuth, socketAuth } = require('./auth')

const player = { id: 'p1', name: 'Alice' }

function forge(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url')
  return body + '.' + sig
}

describe('sign / verify', () => {
  test('round trip returns the player', () => {
    expect(verify(sign(player))).toEqual(player)
  })

  test('rejects a tampered payload', () => {
    const [, sig] = sign(player).split('.')
    const payload = Buffer.from(JSON.stringify({ sub: 'p2', name: 'Eve', exp: Date.now() + 1e6 })).toString('base64url')
    expect(verify(payload + '.' + sig)).toBeNull()
  })

  test('rejects a tampered or truncated signature', () => {
    const token = sign(player)
    const last = token.slice(-1)
    expect(verify(token.slice(0, -1) + (last === 'A' ? 'B' : 'A'))).toBeNull()
    expect(verify(token.slice(0, -2))).toBeNull()
  })

  test('rejects a token signed with another secret', () => {
    const body = Buffer.from(JSON.stringify({ sub: 'p1', name: 'A', exp: Date.now() + 1e6 })).toString('base64url')
    const sig = crypto.createHmac('sha256', 'x'.repeat(40)).update(body).digest('base64url')
    expect(verify(body + '.' + sig)).toBeNull()
  })

  test('rejects an expired token', () => {
    const now = Date.now()
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now)
    const token = sign(player)
    spy.mockReturnValue(now + 24 * 60 * 60 * 1000 + 1)
    expect(verify(token)).toBeNull()
    spy.mockRestore()
  })

  test.each([undefined, null, 42, '', 'nodot', '.sig', 'payload.'])('rejects malformed token %p', (token) => {
    expect(verify(token)).toBeNull()
  })

  test('rejects a correctly signed payload with wrong field types', () => {
    expect(verify(forge({ sub: 1, name: 'A', exp: Date.now() + 1e6 }))).toBeNull()
    expect(verify(forge({ sub: 'p', name: null, exp: Date.now() + 1e6 }))).toBeNull()
    expect(verify(forge({ sub: 'p', name: 'A' }))).toBeNull()
  })

  test('rejects a correctly signed payload that is not JSON', () => {
    const body = Buffer.from('not json').toString('base64url')
    const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url')
    expect(verify(body + '.' + sig)).toBeNull()
  })
})

describe('requireAuth', () => {
  function run(header) {
    const req = { get: (h) => (h === 'Authorization' ? header : undefined) }
    const res = { sendStatus: jest.fn() }
    const next = jest.fn()
    requireAuth(req, res, next)
    return { req, res, next }
  }

  test.each([undefined, '', 'Basic abc', 'Bearer ', 'Bearer garbage', sign(player)])('401 for %p', (header) => {
    const { res, next } = run(header)
    expect(res.sendStatus).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('sets req.player for a valid bearer token', () => {
    const { req, next } = run('Bearer ' + sign(player))
    expect(req.player).toEqual(player)
    expect(next).toHaveBeenCalledWith()
  })
})

describe('socketAuth', () => {
  test('rejects a handshake without a valid token', () => {
    for (const auth of [undefined, {}, { token: 'bad' }]) {
      const next = jest.fn()
      socketAuth({ handshake: { auth }, data: {} }, next)
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'unauthorized' }))
    }
  })

  test('stores the player on socket.data', () => {
    const socket = { handshake: { auth: { token: sign(player) } }, data: {} }
    const next = jest.fn()
    socketAuth(socket, next)
    expect(next).toHaveBeenCalledWith()
    expect(socket.data.player).toEqual(player)
  })
})

test('refuses to load with a short SESSION_SECRET', () => {
  const original = process.env.SESSION_SECRET
  process.env.SESSION_SECRET = 'short'
  try {
    jest.isolateModules(() => {
      expect(() => require('./auth')).toThrow(/SESSION_SECRET/)
    })
  } finally {
    process.env.SESSION_SECRET = original
  }
})
