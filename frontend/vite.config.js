import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    open: false,
  },

  build: {
    // Ship modern ES2020 – no legacy transforms, smaller output
    target: 'es2020',
    // esbuild minifier: bundled with vite 5, fast and reliable
    minify: 'esbuild',
    // Warn when any chunk exceeds 400 kB (default 500)
    chunkSizeWarningLimit: 400,

    rollupOptions: {
      output: {
        // manualChunks as a function — required by rolldown (Vite 8)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('/d3') || id.includes('d3-')) return 'vendor-d3';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          }
        },
      },
    },
  },
})
