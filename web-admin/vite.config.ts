import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(rootDir, '../shared');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': sharedDir,
      zod: path.resolve(rootDir, 'node_modules/zod'),
    },
  },
  server: {
    fs: {
      allow: [rootDir, sharedDir],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
