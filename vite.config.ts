import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/** Dev only: lets the in-browser offline renderer save WAV files to ./renders for listening. */
function saveRenders(): Plugin {
  return {
    name: 'save-renders',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-render', (req, res) => {
        const name = (new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'render').replace(/[^a-z0-9-]/gi, '');
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const dir = resolve(process.cwd(), 'renders');
          mkdirSync(dir, { recursive: true });
          const file = resolve(dir, `${name}.wav`);
          writeFileSync(file, Buffer.concat(chunks));
          res.end(file);
        });
      });
    },
  };
}

// Served from https://<user>.github.io/rhythm-td/ in production.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/rhythm-td/' : '/',
  plugins: [saveRenders()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
