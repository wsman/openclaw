module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server', '<rootDir>/tests', '<rootDir>/plugins'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    'plugins/**/*.ts',
    '!server/**/*.d.ts',
    '!plugins/**/*.d.ts',
    '!server/**/index.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@clinerules/(.*)$': '<rootDir>/.clinerules/$1',
    '^@storage/(.*)$': '<rootDir>/storage/$1',
    '^@agents/(.*)$': '<rootDir>/server/agents/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/config/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }]
  }
};
