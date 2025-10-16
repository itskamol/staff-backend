const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  displayName: 'agent-gateway-integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/agent-gateway-integration',
  testMatch: [
    '<rootDir>/src/app/integration-tests/**/*.spec.ts',
  ],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/../..',
  }),
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.integration.ts'],
  testTimeout: 60000, // 60 seconds for integration tests
  maxWorkers: 1, // Run integration tests sequentially
  forceExit: true,
  detectOpenHandles: true,
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.interface.ts',
    '!src/app/**/*.dto.ts',
    '!src/app/integration-tests/**/*.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
};