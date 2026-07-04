import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom')) return 'vendor-react';
            if (id.includes('node_modules/react')) return 'vendor-react';
            if (id.includes('node_modules/firebase')) return 'vendor-firebase';
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
            if (id.includes('node_modules/@libsql')) return 'vendor-turso';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/chess.js')) return 'vendor-chess';
            if (id.includes('node_modules/stockfish')) return 'vendor-engine';
            if (id.includes('node_modules/motion')) return 'vendor-motion';
            if (id.includes('node_modules/lodash-es')) return 'vendor-utils';
            if (id.includes('node_modules')) return 'vendor-other';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: {},
    },
  };
});
