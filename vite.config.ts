import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      input: 'index.html'
    }
  }
});
