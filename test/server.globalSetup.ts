import { execSync } from 'child_process'
import type { Config } from '@jest/types'

// Recreates prisma/test.db from the migrations once per `jest` run.
export default function(_globalConfig: Config.GlobalConfig, projectConfig: Config.ProjectConfig): void {
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: projectConfig.rootDir,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  })
}
