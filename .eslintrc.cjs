module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'prisma'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      // The Node server (no React) and its Jest helpers.
      files: ['server/**', 'test/**'],
      env: { node: true, browser: false },
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      // Server tests reload modules with require() inside jest.isolateModules.
      files: ['server/**/*.test.ts'],
      env: { jest: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      // Tests load modules in isolation with require() and fake loosely typed
      // socket payloads.
      files: ['client/**/*.test.{ts,tsx}', 'client/test/**'],
      env: { jest: true, node: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
}
