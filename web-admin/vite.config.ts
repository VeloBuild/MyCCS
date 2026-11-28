import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { assertPublishableClientKey } from '../shared/supabase-key-guard';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(rootDir, '../shared');
const supabaseSharedDir = path.resolve(rootDir, '../supabase/functions/_shared');

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, rootDir, 'VITE_');
  const publishableKey =
    loadedEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  assertPublishableClientKey(publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': sharedDir,
        zod: path.resolve(rootDir, 'node_modules/zod'),
      },
    },
    server: {
      fs: {
        allow: [rootDir, sharedDir, supabaseSharedDir],
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
