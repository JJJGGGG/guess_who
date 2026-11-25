import 'dotenv/config'
import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import type { Player } from '../shared/types.ts'
import type { GameSocket } from './types.ts'

const SECRET = process.env.SESSION_SECRET
if (!SECRET || Buffer.byteLength(SECRET) < 32) {
  throw new Error('SESSION_SECRET must be set to at least 32 bytes')
}
const KEY: string = SECRET

const TTL_MS = 24 * 60 * 60 * 1000

function hmac(data: string): string {
  return crypto.createHmac('sha256', KEY).update(data).digest('base64url')
}

export function sign(player: Player): string {
  const payload = Buffer.from(JSON.stringify({
    sub: player.id,
    name: player.name,
    exp: Date.now() + TTL_MS
  })).toString('base64url')
  return payload + '.' + hmac(payload)
}

// Returns {id, name} for a valid, unexpired token, otherwise null.
export function verify(token: unknown): Player | null {
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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.get('Authorization') || ''
  const player = verify(header.startsWith('Bearer ') ? header.slice(7) : null)
  if (!player) {
    res.sendStatus(401)
    return
  }
  req.player = player
  next()
}

// The player requireAuth attached. Throws (500) if a route forgot requireAuth.
export function playerOf(req: Request): Player {
  if (!req.player) throw new Error('route is missing requireAuth')
  return req.player
}

export function socketAuth(socket: GameSocket, next: (err?: Error) => void): void {
  const player = verify(socket.handshake.auth && socket.handshake.auth.token)
  if (!player) {
    return next(new Error('unauthorized'))
  }
  socket.data.player = player
  next()
}
