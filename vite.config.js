import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Long-lived editor tabs must not depend on deployment-specific lazy
        // chunk hashes. These names stay stable, while /assets responses are
        // forced to revalidate, so an open tab can load the current chunk after
        // a deploy instead of requesting a deleted old hash and entering a
        // reload loop.
        chunkFileNames(chunkInfo) {
          const name = String(chunkInfo?.name || '');
          if (name === 'CodeEditor') return 'assets/[name]-runtime-v2.js';
          return 'assets/[name]-runtime.js';
        },
        assetFileNames(assetInfo) {
          const name = String(assetInfo?.name || '');
          if (name === 'workspace-shell.css') return 'assets/[name]-runtime-v2[extname]';
          if (name.endsWith('.css')) return 'assets/[name]-runtime[extname]';
          return 'assets/[name]-[hash][extname]';
        },
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
