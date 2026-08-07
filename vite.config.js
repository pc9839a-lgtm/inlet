import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Pagero is a long-lived SPA. Users often keep /app or /dashboard open while
    // a new Cloudflare Pages deployment replaces the previous hashed chunks.
    // In that situation React.lazy() can request a chunk from the old deployment
    // and fail even though the new deployment itself is healthy.
    //
    // Bundle dynamic imports into the main application artifact so navigation
    // never depends on a deployment-old lazy chunk. Also keep CSS in one hashed
    // asset for the same reason. The hashed main assets can still be cached
    // immutably; a fresh HTML document points at the new hashes after deploy.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
