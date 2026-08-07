import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Keep all component CSS in the initial stylesheet so a tab that stays open
    // across a deployment never has to fetch an old, now-missing lazy CSS hash.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Dynamic JS stays split for bundle size, but its URL remains stable
        // between deployments. This prevents long-lived /app tabs from requesting
        // a deleted hashed lazy chunk after a new Cloudflare deployment.
        chunkFileNames: 'assets/[name]-runtime.js',
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
