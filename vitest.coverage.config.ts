import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/helpers/mysql-container.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 120_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/domain/**/*.ts',
        'src/application/**/*.ts',
        'src/infrastructure/**/*.ts',
        'src/lib/**/*.ts',
      ],
      exclude: ['src/infrastructure/database/migrations/**/*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
      },
    },
  },
});
