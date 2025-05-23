import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/ccip-api': {
        target: 'https://ccip.chain.link',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ccip-api/, '/api'),
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
      '/circle-api': {
        target: 'https://iris-api-sandbox.circle.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/circle-api/, '/v1'),
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
    },
  },
});
