import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
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
