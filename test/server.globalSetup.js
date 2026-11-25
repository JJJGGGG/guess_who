const { execSync } = require('child_process')
const path = require('path')

// Recreates prisma/test.db from the migrations once per `jest` run.
module.exports = function() {
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  })
}
