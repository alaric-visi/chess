import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Splits big, rarely-changing libraries into their own long-cached chunks. */
const vendorChunk = (id: string): string | undefined => {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules\/three\//.test(id)) return 'three';
  if (
    /node_modules\/(@react-three|@react-spring|three-stdlib|troika|camera-controls|maath|zustand|suspend-react|its-fine)/.test(
      id,
    )
  ) {
    return 'r3f';
  }
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
  return 'vendor';
};

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    // three.js is one ~730 kB (190 kB gzip) module that can't be split
    // further; it gets its own long-cached chunk instead.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
});
