import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const MAX_COPY_RETRIES = 10;
const packageJsonRaw = readFileSync(new URL('./package.json', import.meta.url), 'utf-8');
const packageJson = JSON.parse(packageJsonRaw) as { version?: string };
const appVersion = packageJson.version?.trim() || '0.1.0';

function isRetriableFsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function copyFileWithRetries(
  source: string,
  destination: string,
  maxAttempts: number
): Promise<void> {
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error('maxAttempts must be a positive integer');
  }
  let attempt = 0;
  // Small backoff to tolerate transient Windows file locks (AV/indexers, etc).
  while (true) {
    attempt += 1;
    try {
      await fs.copyFile(source, destination);
      return;
    } catch (error) {
      if (!isRetriableFsError(error) || attempt >= maxAttempts) throw error;
      await sleep(50 * attempt);
    }
  }
}

function robustCopyPublicDirPlugin() {
  return {
    name: 'robust-copy-public-dir',
    async closeBundle() {
      const publicDir = path.resolve(process.cwd(), 'public');
      const outDir = path.resolve(process.cwd(), 'dist');
      // Fast-exit if public dir doesn't exist.
      try {
        await fs.access(publicDir);
      } catch {
        return;
      }

      const stack: Array<{ srcDir: string; relDir: string }> = [{ srcDir: publicDir, relDir: '' }];

      while (stack.length > 0) {
        const next = stack.pop();
        if (!next) break;

        const { srcDir, relDir } = next;
        const destDir = path.join(outDir, relDir);

        await fs.mkdir(destDir, { recursive: true });

        const dirEntries = await fs.readdir(srcDir, { withFileTypes: true });
        for (const dirent of dirEntries) {
          const srcPath = path.join(srcDir, dirent.name);
          const relPath = path.join(relDir, dirent.name);
          const destPath = path.join(outDir, relPath);

          if (dirent.isDirectory()) {
            stack.push({ srcDir: srcPath, relDir: relPath });
            continue;
          }

          if (dirent.isFile()) {
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await copyFileWithRetries(srcPath, destPath, MAX_COPY_RETRIES);
          }
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.VITE_DEV_PORT ?? 5173);
  const devHmrHost = env.VITE_DEV_HMR_HOST;
  const devServiceWorkerEnabled = env.VITE_PWA_DEV_SW === 'true';

  const deriveBaseUrlFromWebSocketUrl = (webSocketUrl: string): string | undefined => {
    try {
      const url = new URL(webSocketUrl.trim());

      // Map ws/wss -> http/https.
      if (url.protocol === 'ws:') url.protocol = 'http:';
      else if (url.protocol === 'wss:') url.protocol = 'https:';
      else return undefined;

      url.pathname = '/';
      url.search = '';
      url.hash = '';

      return url.toString();
    } catch {
      return undefined;
    }
  };

  const haBaseUrl = (() => {
    const baseUrl = env.VITE_HA_BASE_URL?.trim();
    if (baseUrl) return baseUrl;

    const wsUrl = env.VITE_HA_WEBSOCKET_URL?.trim();
    if (wsUrl) return deriveBaseUrlFromWebSocketUrl(wsUrl);

    return undefined;
  })();

  // Optional override to help in environments where Node can't resolve mDNS
  // hostnames (e.g. `homeassistant.local`). Point this at an IP instead.
  const haProxyTarget = env.VITE_HA_PROXY_TARGET?.trim() || haBaseUrl;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    server: {
      // Needed to access the dev server from other machines (LAN).
      // Equivalent to `vite --host 0.0.0.0`.
      host: true,
      port: Number.isFinite(devPort) ? devPort : 5173,
      strictPort: true,
      // In WSL2, HMR can sometimes pick an unreachable host. If HMR misbehaves
      // when loading from another machine, set VITE_DEV_HMR_HOST to your Windows
      // LAN IP (e.g. 192.168.1.50).
      hmr: devHmrHost ? { host: devHmrHost } : undefined,

      // Dev-only: proxy Home Assistant API calls to avoid browser CORS.
      // Consumers can fetch `/api/...` from the app origin and Vite will forward
      // to the configured Home Assistant base URL.
      proxy: haProxyTarget
        ? {
            '/api': {
              target: haProxyTarget,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    build: {
      // We copy public/ ourselves with retries (see plugin) to avoid intermittent
      // Windows EBUSY locks during Vite's built-in copy step.
      copyPublicDir: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            // Normalize to POSIX separators since Rollup/Vite ids can vary by platform.
            const normalizedId = id.replaceAll('\\', '/');

            // Group the biggest/most-stable deps into their own cacheable chunks.
            // Important: React depends on scheduler / use-sync-external-store. If those land in a
            // different chunk, Rollup can create a circular chunk graph (react-vendor <-> vendor)
            // which breaks module initialization in some environments (e.g. Lighthouse).
            if (
              normalizedId.includes('/react/') ||
              normalizedId.includes('/react-dom/') ||
              normalizedId.includes('/scheduler/') ||
              normalizedId.includes('/use-sync-external-store/') ||
              normalizedId.includes('/react-is/')
            ) {
              return 'react-vendor';
            }

            if (normalizedId.includes('/@radix-ui/')) return 'radix-vendor';
            if (normalizedId.includes('/konva/') || normalizedId.includes('/react-konva/')) {
              return 'konva-vendor';
            }
            if (
              normalizedId.includes('/inversify/') ||
              normalizedId.includes('/reflect-metadata/')
            ) {
              return 'di-vendor';
            }
            if (normalizedId.includes('/ajv/') || normalizedId.includes('/yaml/'))
              return 'data-vendor';

            return 'vendor';
          },
        },
      },
    },
    plugins: [
      react(),
      robustCopyPublicDirPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        devOptions: {
          enabled: devServiceWorkerEnabled,
          type: 'module',
        },
        includeAssets: [
          'favicon.svg',
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,yaml}'],
          cacheId: `hass-dash-v${appVersion}`,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.includes('/api/image_proxy/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'ha-avatar-images',
                cacheableResponse: {
                  statuses: [0, 200],
                },
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'app-images',
                cacheableResponse: {
                  statuses: [0, 200],
                },
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
          ],
        },
      }),
    ],
  };
});
