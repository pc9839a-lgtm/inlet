import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Content-address every lazy chunk and stylesheet. Old open tabs that
        // request a removed hash are recovered by Functions middleware, while
        // current assets can be cached immutably for one year.
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          const normalized = String(id || '').replaceAll('\\', '/');
          if (normalized.includes('/src/preview/')) return 'landing-runtime';
          if (
            normalized.includes('/src/screens/WorkspaceEditorScreen.jsx')
            || normalized.includes('/src/screens/workspace/')
          ) {
            return 'workspace-shell';
          }
          return undefined;
        },
      },
    },
  },
});
