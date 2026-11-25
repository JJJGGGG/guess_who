const request = require('supertest')
const { app } = require('../../test/app')
const { verify } = require('../auth')
const { session } = require('../../test/helpers')

describe('POST /api/session', () => {
  test('issues a token for a trimmed name', async () => {
    const res = await request(app).post('/api/session').send({ name: '  Alice  ' })
    expect(res.status).toBe(200)
    expect(res.body.player).toEqual({ id: expect.any(String), name: 'Alice' })
    expect(res.body.graceSeconds).toBe(1)
    expect(verify(res.body.token)).toEqual(res.body.player)
  })

  test('gives every session a new id', async () => {
    const a = await request(app).post('/api/session').send({ name: 'Same' })
    const b = await request(app).post('/api/session').send({ name: 'Same' })
    expect(a.body.player.id).not.toBe(b.body.player.id)
  })

  test.each([{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(21) }, { name: { $ne: 1 } }])(
    '400 for %p', async (body) => {
      const res = await request(app).post('/api/session').send(body)
      expect(res.status).toBe(400)
      expect(res.body.error).toEqual(expect.any(String))
    })

  test('ignores a client-supplied id', async () => {
    const res = await request(app).post('/api/session').send({ name: 'Eve', id: 'victim' })
    expect(res.body.player.id).not.toBe('victim')
  })
})

describe('GET /api/session', () => {
  test('returns the player for a valid token', async () => {
    const s = session('Bob')
    const res = await request(app).get('/api/session').set('Authorization', s.auth)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ player: s.player, graceSeconds: 1 })
  })

  test('401 without a token', async () => {
    expect((await request(app).get('/api/session')).status).toBe(401)
  })
})
