import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Generouted from '@generouted/react-router/plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    Generouted(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
