import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/globalSetup.js'],
    setupFiles: ['tests/setup.js'],
    // One in-memory replica set is shared; keep files sequential so they don't
    // stomp on each other's collections.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
