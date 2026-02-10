import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Code splitting for faster loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - loaded once, cached
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-markdown', 'remark-gfm'],
          // Feature chunks - loaded on demand
          'feature-chatbot': ['@aws-sdk/eventstream-codec', '@aws-sdk/util-utf8'],
        },
      },
    },
    // Smaller chunks for faster loading
    chunkSizeWarningLimit: 200,
  },
})
