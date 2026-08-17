import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    esbuild: {
      drop: ['debugger'],
      pure: ['console.log', 'console.debug'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            // Keep firebase & supabase separate — they are large and self-contained
            if (id.includes('node_modules/firebase')) return 'vendor-firebase';
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
            if (id.includes('node_modules/@libsql')) return 'vendor-turso';
            // Chess engine — large WASM/JS, self-contained
            if (id.includes('node_modules/stockfish')) return 'vendor-engine';
            if (id.includes('node_modules/chess.js')) return 'vendor-chess';
            // Everything else: React, ReactDOM, router, icons, motion, zustand, lodash, etc.
            // Put in ONE chunk to avoid circular dependencies.
            return 'vendor';
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    },
  };
});
