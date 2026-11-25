const crypto = require('crypto')

require('dotenv').config()

const SECRET = process.env.SESSION_SECRET
if (!SECRET || Buffer.byteLength(SECRET) < 32) {
  throw new Error('SESSION_SECRET must be set to at least 32 bytes')
}

const TTL_MS = 24 * 60 * 60 * 1000

function hmac(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

function sign(player) {
  const payload = Buffer.from(JSON.stringify({
    sub: player.id,
    name: player.name,
    exp: Date.now() + TTL_MS
  })).toString('base64url')
  return payload + '.' + hmac(payload)
}

// Returns {id, name} for a valid, unexpired token, otherwise null.
function verify(token) {
  if (typeof token !== 'string') return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null

  const expected = Buffer.from(hmac(payload))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null
  }

  try {
    const { sub, name, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof sub !== 'string' || typeof name !== 'string' || !(exp > Date.now())) return null
    return { id: sub, name }
  } catch (e) {
    return null
  }
}

function requireAuth(req, res, next) {
  const header = req.get('Authorization') || ''
  const player = verify(header.startsWith('Bearer ') ? header.slice(7) : null)
  if (!player) {
    return res.sendStatus(401)
  }
  req.player = player
  next()
}

function socketAuth(socket, next) {
  const player = verify(socket.handshake.auth && socket.handshake.auth.token)
  if (!player) {
    return next(new Error('unauthorized'))
  }
  socket.data.player = player
  next()
}

module.exports = { sign, verify, requireAuth, socketAuth }
