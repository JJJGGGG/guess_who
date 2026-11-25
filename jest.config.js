// Two projects: the Express/Prisma server (Node, real SQLite test database)
// and the React client (jsdom). Run one with `npm run test:server` / `test:client`.
module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/*.test.js'],
      setupFiles: ['<rootDir>/test/server.env.js'],
      globalSetup: '<rootDir>/test/server.globalSetup.js',
      // Plain CommonJS, nothing to compile.
      transform: {},
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
