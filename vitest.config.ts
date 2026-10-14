import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The suite must pass with no network and no API key, so nothing here starts a server
    // or reads credentials.
    env: {
      NODE_ENV: 'test',
    },
  },
});
