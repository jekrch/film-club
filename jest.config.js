/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Transpile to CommonJS so JSON default imports and CJS builds of ESM
        // deps (react-router-dom, @testing-library) resolve correctly, and so
        // `esModuleInterop` can provide the `import x from './data.json'` default.
        // Type-checking is owned by `bun run typecheck`; transpile-only here keeps
        // the suite fast and avoids per-worker type-check memory blowups.
        isolatedModules: true,
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          target: 'ES2020',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/test-utils/**',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
};
