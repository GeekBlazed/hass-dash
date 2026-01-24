import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
            await copyFileWithRetries(srcPath, destPath, 10);
          }
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
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
