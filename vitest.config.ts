import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Prevent huge console output from being buffered/printed for passing tests.
    // This notably helps coverage runs avoid OOM when debug logging is verbose.
    silent: 'passed-only',
    css: true,
    // Coverage runs can be memory-heavy. Use real child processes so memory can
    // be reclaimed between files.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    // Recycle workers before they balloon and crash the run.
    vmMemoryLimit: '1024MB',
    coverage: {
      // Istanbul instruments every module and can be extremely memory hungry in large jsdom suites.
      // V8 coverage is substantially lighter and avoids fork-worker OOM in CI.
      provider: 'v8',
      // `text` is very verbose (full per-file table). `text-summary` keeps CLI output readable.
      // Keep report generation lightweight to avoid OOM during coverage runs.
      reporter: ['text-summary', 'lcovonly'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/vite.config.ts',
        '**/vitest.config.ts',
        '**/eslint.config.js',
        '**/tailwind.config.js',
        '**/postcss.config.js',
        // Dev-only components
        '**/ComponentShowcase.tsx',
        '**/DebugPanel.tsx',
        // Branch-heavy hook wiring; measured via higher-level marker/bridge tests.
        '**/components/dashboard/DeviceLocationTrackingController.tsx',
        // Large DOM-heavy marker bridge; instrumentation is expensive and is covered indirectly.
        '**/components/dashboard/stage/TrackedDeviceMarkersBridge.tsx',
        // Very large DOM-heavy bridge; coverage instrumentation can OOM the worker.
        '**/components/dashboard/stage/HaRoomLightingOverlayBridge.tsx',
        // Barrel exports (re-exports only)
        '**/components/dashboard/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
