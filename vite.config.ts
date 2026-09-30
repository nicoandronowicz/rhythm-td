import { defineConfig } from 'vitest/config';

// Served from https://<user>.github.io/rhythm-td/ in production.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/rhythm-td/' : '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
