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
        secure: false,
        rewrite: (path) => path.replace(/^\/ccip-api/, '/api/h/atlas'),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
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
