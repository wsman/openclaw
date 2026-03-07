import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@jest/globals': path.resolve(__dirname, 'tests/support/jest-globals-shim.ts'),
      '@qdrant/js-client-rest': path.resolve(__dirname, 'tests/support/mocks/qdrant-js-client-rest.ts'),
      'multicast-dns': path.resolve(__dirname, 'tests/support/mocks/multicast-dns.ts'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.js',
      'tests/**/*.spec.ts',
      'tests/**/*.spec.js',
      'server/**/*.test.ts',
      'server/**/*.test.js',
      'server/**/*.spec.ts',
      'server/**/*.spec.js',
      'plugins/**/*.test.ts',
      'plugins/**/*.test.js',
      'plugins/**/*.spec.ts',
      'plugins/**/*.spec.js',
      'src/**/*.test.ts',
      'src/**/*.test.js',
      'src/**/*.spec.ts',
      'src/**/*.spec.js'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'ui/node_modules/**',
      'ui/**',
      'projects/**'
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      include: [
        'plugins/core/**/*.ts',
        'server/**/*.ts',
        'src/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
      ],
      all: true,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    testTimeout: 15000,
    hookTimeout: 10000,
  },
});
