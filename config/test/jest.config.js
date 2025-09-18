module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '../..',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['src/**/*.(t|j)s'],
    coverageDirectory: './coverage',
    testEnvironment: 'node',
    // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // This file does not exist
    globals: {
        'ts-jest': {
            tsconfig: '<rootDir>/tsconfig.spec.json',
            isolatedModules: true,
        },
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/core/(.*)$': '<rootDir>/src/core/$1',
        '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
        '^@/modules/(.*)$': '<rootDir>/src/modules/$1',
    },
};
