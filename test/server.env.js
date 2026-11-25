// Runs before every server test file, before any app module is required.
// dotenv never overrides variables that are already set, so these win over .env.
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-0123'
process.env.DATABASE_URL = 'file:./test.db'
process.env.GRACE_SECONDS = '1'
process.env.EMPTY_ROOM_TTL_MINUTES = '0'
process.env.MAX_OPEN_ROOMS = '5'
process.env.RATE_LIMIT_WRITES_PER_MIN = '100000'
process.env.RATE_LIMIT_SESSIONS_PER_MIN = '100000'
process.env.RATE_LIMIT_ROOMS_PER_MIN = '100000'
process.env.RATE_LIMIT_MESSAGES_PER_MIN = '100000'
