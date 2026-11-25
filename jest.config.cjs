// Two projects: the Express/Prisma server (Node, real SQLite test database)
// and the React client (jsdom). Run one with `npm run test:server` / `test:client`.
module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/*.test.ts'],
      setupFiles: ['<rootDir>/test/server.env.ts'],
      globalSetup: '<rootDir>/test/server.globalSetup.ts',
      // TypeScript ESM, compiled to CommonJS by babel-jest (babel.config.cjs).
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/client/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/client/test/setup.ts'],
      moduleNameMapper: {
        '\\.(css|webp|png|svg)$': '<rootDir>/client/test/fileStub.ts',
        // socket.tsx reads import.meta.env, which Jest can't parse; tests drive
        // a fake socket instead.
        '^\\.\\.?/socket$': '<rootDir>/client/test/socketMock.ts',
      },
    },
  ],
  // All server test files share one SQLite file.
  maxWorkers: 1,
};
