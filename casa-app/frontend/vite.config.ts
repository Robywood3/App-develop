import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Casa App',
        short_name: 'Casa',
        description: 'La casa di Casale Litta',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f1216',
        theme_color: '#0f1216',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // the app shell works offline; /api is never cached (live data only)
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: { '/api': { target: 'http://localhost:8000', ws: true } },
  },
  preview: {
    proxy: { '/api': { target: 'http://localhost:8000', ws: true } },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts?(x)'],
  },
});
