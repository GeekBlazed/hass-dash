import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            // Group the biggest/most-stable deps into their own cacheable chunks.
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
            if (id.includes('/@radix-ui/')) return 'radix-vendor';
            if (id.includes('/konva/') || id.includes('/react-konva/')) return 'konva-vendor';
            if (id.includes('/inversify/') || id.includes('/reflect-metadata/')) return 'di-vendor';
            if (id.includes('/ajv/') || id.includes('/yaml/')) return 'data-vendor';

            return 'vendor';
          },
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: [
          'favicon.svg',
          'manifest.webmanifest',
          'icons/apple-touch-icon.png',
          'icons/quick-actions.svg',
          'icons/pwa-192.png',
          'icons/pwa-512.png',
          'icons/pwa-maskable-192.png',
          'icons/pwa-maskable-512.png',
        ],
        manifestFilename: 'manifest.webmanifest',
        manifest: {
          name: 'Home Assistant Dashboard',
          short_name: 'hass-dash',
          description: 'Your smart home, visualized.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#090909',
          theme_color: '#090909',
          icons: [
            {
              src: '/favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/icons/pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/pwa-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
